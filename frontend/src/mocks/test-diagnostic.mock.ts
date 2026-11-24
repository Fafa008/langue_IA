import { ApiError } from "@/lib/api-client";
import { ETAPES, etapeDe } from "@/lib/etapesTest";
import { LANGUES } from "@/lib/languages";
import { cadreDeLangue, ECHELLES } from "@/lib/referentiels";
import { QUESTIONS_TEST, type QuestionMock } from "@/mocks/questions-test.mock";
import { sourceDomaine, sourceNiveau } from "@/mocks/referentiel-rag.mock";
import {
  COMPETENCES_TEST,
  type CompetenceResultat,
  type CompetenceTest,
  type DonneeAnalyse,
  type DomaineFaiblesse,
  type EtapePlan,
  type FormatExercice,
  type IssueTerminaison,
  type LangueDiagnostic,
  type ObjectifFormation,
  type Question,
  type ReponseTest,
  type ResultatTest,
  type RetourReponse,
  type SessionTest,
  type TestInterrompu,
} from "@/types/test-diagnostic";

/** 5 exercices par compétence × 4 compétences = 20 exercices, 5 points chacun → 100. */
export const POINTS_PAR_EXERCICE = 5;
const NOMBRE_PAR_ETAPE = 5;

/**
 * Démo : reconstruit la bonne réponse à partir de la banque simulée, sans jamais l'exposer au composant
 * avant validation. Le service HTTP refuse cette variante : le backend ne transmet pas les corrections.
 */
function reponseAutomatique(question: QuestionMock): ReponseTest {
  if (question.typeReponse === "choix") {
    if (question.bonneReponse === undefined) {
      throw new ApiError(422, "Correction simulée indisponible pour cette question.");
    }
    return { type: "choix", choix: question.bonneReponse };
  }
  if (!question.reponseAttendue) {
    throw new ApiError(422, "Correction simulée indisponible pour cette question.");
  }
  return question.typeReponse === "texte"
    ? { type: "texte", texte: question.reponseAttendue }
    : { type: "audio", audio: new Blob([question.reponseAttendue], { type: "audio/webm" }) };
}

/** Plan visé, réduit si la banque d'une langue n'a pas assez d'exercices. */
const PLAN_VISE: EtapePlan[] = [
  { etape: "qcm", nombreQuestions: NOMBRE_PAR_ETAPE },
  { etape: "comprehension_orale", nombreQuestions: NOMBRE_PAR_ETAPE },
  { etape: "expression_orale", nombreQuestions: NOMBRE_PAR_ETAPE },
  { etape: "expression_ecrite", nombreQuestions: NOMBRE_PAR_ETAPE },
];

/** Banque de questions simulée d'une langue (vide pour une langue inconnue). */
const banqueDe = (langue: string): QuestionMock[] =>
  (QUESTIONS_TEST as Record<string, QuestionMock[] | undefined>)[langue] ?? [];

/** Plan réellement possible avec la banque de la langue. */
const planPour = (banque: QuestionMock[]): EtapePlan[] =>
  PLAN_VISE
    .map(({ etape, nombreQuestions }) => ({
      etape,
      nombreQuestions: Math.min(nombreQuestions, banque.filter((q) => etapeDe(q.competence) === etape).length),
    }))
    .filter(({ nombreQuestions }) => nombreQuestions > 0);

const totalDu = (plan: EtapePlan[]) => plan.reduce((total, { nombreQuestions }) => total + nombreQuestions, 0);

interface SessionMock {
  id: string;
  langue: string;
  banque: QuestionMock[];
  niveaux: string[];
  plan: EtapePlan[];
  total: number;
  questionCourante: QuestionMock;
  dejaPosees: Set<string>;
  /** Niveau estimé (indice dans `niveaux`) : il monte ou descend après chaque réponse à choix. */
  niveauVise: number;
  niveauxVises: number[];
  /** Nombre de bonnes réponses, utilisé pour faire évoluer le niveau. */
  bonnes: number;
  /** Note sur 100 : POINTS_PAR_EXERCICE par bonne réponse. */
  score: number;
  scoresCompetences: Record<CompetenceTest, { score: number; total: number }>;
  /** Début de la question courante, pour le temps de réponse transmis à l'analyse. */
  debutQuestion: number;
  /** Dossier par exercice destiné à l'agent diagnostic. */
  donneesAnalyse: DonneeAnalyse[];
  terminee: boolean;
  derniereReponse: { idQuestion: string; reponse: ReponseTest; retour: RetourReponse } | null;
}

/** Démonstration : l'analyse d'une réponse libre par le LLM prend un peu de temps. */
const DUREE_ANALYSE_MS = 1200;
const analyseSimulee = () => new Promise((resolve) => setTimeout(resolve, DUREE_ANALYSE_MS));

/** Comparaison tolérante à la casse, aux accents et à la ponctuation (dictée et texte à trous). */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const formatDe = (question: QuestionMock): FormatExercice => question.format ?? "qcm";

const sessions = new Map<string, SessionMock>();
let prochainId = 1;

/** Étape de la prochaine question, d'après le nombre de réponses déjà données. */
function etapeSuivante(session: SessionMock) {
  let dejaRepondues = session.niveauxVises.length;
  for (const { etape, nombreQuestions } of session.plan) {
    if (dejaRepondues < nombreQuestions) return etape;
    dejaRepondues -= nombreQuestions;
  }
  return null;
}

/**
 * Question suivante : dans l'étape en cours, la plus proche du niveau estimé.
 * Les sujets d'expression orale et écrite sont donc choisis au niveau atteint pendant le QCM.
 */
function choisirQuestion(session: SessionMock): QuestionMock | null {
  const etape = etapeSuivante(session);
  if (!etape) return null;
  const candidates = session.banque.filter(
    (item) => ETAPES[etape].competences.includes(item.competence) && !session.dejaPosees.has(item.id),
  );
  const ecart = (item: QuestionMock) => Math.abs(session.niveaux.indexOf(item.niveau) - session.niveauVise);
  const plusProches = candidates.filter((item) => ecart(item) === Math.min(...candidates.map(ecart)));
  // À niveau égal, on varie les compétences (grammaire puis compréhension écrite)
  return plusProches.find((item) => session.scoresCompetences[item.competence].total === 0) ?? plusProches[0] ?? null;
}

function sansCorrection({ bonneReponse: _bonneReponse, reponseAttendue: _reponseAttendue, ...question }: QuestionMock) {
  return question;
}

function creerScoresCompetences(): SessionMock["scoresCompetences"] {
  return {
    grammaire: { score: 0, total: 0 },
    lecture: { score: 0, total: 0 },
    ecoute: { score: 0, total: 0 },
    ecrit: { score: 0, total: 0 },
    oral: { score: 0, total: 0 },
  };
}

/** Domaines signalés pour une compétence en lacune : le QCM de grammaire évalue aussi le vocabulaire. */
const DOMAINES_DE_LACUNE: Record<CompetenceTest, DomaineFaiblesse[]> = {
  grammaire: ["grammaire", "vocabulaire"],
  lecture: ["comprehension_ecrite"],
  ecoute: ["comprehension_orale"],
  ecrit: ["expression_ecrite"],
  oral: ["expression_orale"],
};

/**
 * Mode de l'analyse simulée (F-07) : « complete » (défaut) renvoie la justification et le détail des points faibles ;
 * « partielle » reproduit une analyse réelle incomplète : pas de justification, points faibles sans détail, phase présente.
 * Choisi par NEXT_PUBLIC_ANALYSE_SIMULEE=partielle.
 */
export type ModeAnalyseSimulee = "complete" | "partielle";
export const MODE_ANALYSE_SIMULEE: ModeAnalyseSimulee =
  process.env.NEXT_PUBLIC_ANALYSE_SIMULEE === "partielle" ? "partielle" : "complete";

/** Applique le mode d'analyse à un résultat complet, sans jamais inventer de donnée. */
export function appliquerModeAnalyse(resultat: ResultatTest, mode: ModeAnalyseSimulee = MODE_ANALYSE_SIMULEE): ResultatTest {
  if (mode === "complete") return resultat;
  return {
    ...resultat,
    justification: undefined,
    pointsFaibles: resultat.pointsFaibles?.map(({ domaine }) => ({ domaine })),
  };
}

/** Résultat d'après les réponses données jusqu'ici (fin normale ou temps écoulé). */
function calculerResultat(session: SessionMock): ResultatTest {
  const repondues = session.niveauxVises.length;
  const valeursNiveau = [...session.niveauxVises.slice(-5), session.niveauVise];
  const indexNiveau = Math.round(valeursNiveau.reduce((sum, value) => sum + value, 0) / valeursNiveau.length);
  const niveau = repondues > 0 && session.bonnes === repondues
    ? session.niveaux[session.niveaux.length - 1]
    : session.bonnes === 0
      ? session.niveaux[0]
      : session.niveaux[indexNiveau];
  const evaluees = COMPETENCES_TEST.filter((competence) => session.scoresCompetences[competence].total > 0);
  const lacunes = evaluees.filter((competence) => {
    const { score, total } = session.scoresCompetences[competence];
    return score / total < 0.5;
  });

  // Démonstration de l'analyse LLM + RAG : points faibles expliqués, phase Assimil et descripteurs cités
  const cadre = cadreDeLangue(session.langue);
  const echelle = ECHELLES[cadre];
  const faiblesses = lacunes.flatMap((competence) => DOMAINES_DE_LACUNE[competence])
    .map((domaine) => ({ domaine, ...sourceDomaine(cadre, niveau, domaine) }));
  return appliquerModeAnalyse({
    niveau,
    score: session.score,
    // Les exercices sans réponse (temps écoulé) comptent comme faux : le total reste 100.
    total: session.total,
    donneesAnalyse: session.donneesAnalyse,
    competences: evaluees.map<CompetenceResultat>((competence) => ({ competence, ...session.scoresCompetences[competence] })),
    lacunes,
    pointsFaibles: faiblesses.map(({ domaine, detail }) => ({ domaine, detail })),
    phaseAssimil: echelle.indexOf(niveau) <= 1 ? "impregnation" : "activation",
    justification: {
      resume: `Avec ${session.bonnes} bonne(s) réponse(s) sur ${repondues}, vos réponses correspondent aux descripteurs du niveau ${niveau}`
        + (faiblesses.length > 0 ? ", avec des points à consolider." : ", sans point faible marqué."),
      sources: [sourceNiveau(cadre, echelle, niveau), ...faiblesses.map(({ source }) => source)],
    },
  });
}

export const testDiagnosticMockService = {
  async langues(): Promise<LangueDiagnostic[]> {
    return LANGUES.map(({ code, libelle }) => {
      const cadre = cadreDeLangue(code);
      const nombreQuestions = totalDu(planPour(banqueDe(code)));
      return { code, libelle, cadre, niveaux: [...ECHELLES[cadre]], nombreQuestions, disponible: nombreQuestions > 0 };
    });
  },

  async demarrer(langue: string, _objectif: ObjectifFormation, _creneaux: string[]): Promise<SessionTest> {
    const banque = banqueDe(langue);
    const plan = planPour(banque);
    if (plan.length === 0) throw new ApiError(404, "Aucune question n'est disponible pour cette langue.");
    // Niveaux de la banque, du plus bas au plus haut, en suivant l'échelle du référentiel
    const niveaux = ECHELLES[cadreDeLangue(langue)].filter((niveau) => banque.some((q) => q.niveau === niveau));

    const id = `test-${prochainId++}`;
    const session: SessionMock = {
      id,
      langue,
      banque,
      niveaux,
      plan,
      total: totalDu(plan) * POINTS_PAR_EXERCICE,
      questionCourante: banque[0],
      dejaPosees: new Set(),
      // Le test commence au milieu de l'échelle, puis s'adapte
      niveauVise: Math.floor((niveaux.length - 1) / 2),
      niveauxVises: [],
      bonnes: 0,
      score: 0,
      scoresCompetences: creerScoresCompetences(),
      debutQuestion: Date.now(),
      donneesAnalyse: [],
      terminee: false,
      derniereReponse: null,
    };
    const premiere = choisirQuestion(session);
    if (!premiere) throw new ApiError(404, "Aucune question n'est disponible pour cette langue.");
    session.questionCourante = premiere;
    session.dejaPosees.add(premiere.id);
    sessions.set(id, session);

    return {
      id,
      langue,
      niveaux,
      numeroQuestion: 1,
      totalQuestions: totalDu(plan),
      plan,
      question: sansCorrection(premiere),
    };
  },

  async repondre(
    idSession: string,
    idQuestion: string,
    reponse: ReponseTest,
    _valeurChoix?: string,
    _progression?: { numeroQuestion: number; totalQuestions: number; questionSuivante: Question | null },
  ): Promise<RetourReponse> {
    const session = sessions.get(idSession);
    if (!session) throw new ApiError(404, "Session de test introuvable.");
    if (session.derniereReponse?.idQuestion === idQuestion) {
      const precedente = session.derniereReponse.reponse;
      const identique = precedente.type === reponse.type && (
        precedente.type === "choix" && reponse.type === "choix" ? precedente.choix === reponse.choix
          : precedente.type === "texte" && reponse.type === "texte" ? precedente.texte === reponse.texte
            : precedente.type === "audio" && reponse.type === "audio" ? precedente.audio === reponse.audio
              : precedente.type === "sans_reponse" && reponse.type === "sans_reponse" ? true
                : precedente.type === "automatique" && reponse.type === "automatique" ? true
                  : false
      );
      if (identique) return session.derniereReponse.retour;
      throw new ApiError(409, "Une autre réponse a déjà été enregistrée pour cette question.");
    }
    if (session.terminee || session.questionCourante.id !== idQuestion) {
      throw new ApiError(409, "Cette question a déjà reçu une réponse.");
    }
    const question = session.questionCourante;
    // Le bouton « Passer » demande au mock de fournir la correction : on la transforme en vraie réponse
    // avant la validation, pour réutiliser exactement le même calcul de score que pour un apprenant.
    const reponseEffective: ReponseTest = reponse.type === "automatique"
      ? reponseAutomatique(question)
      : reponse;
    const choixValide = reponseEffective.type === "choix"
      && Number.isInteger(reponseEffective.choix)
      && reponseEffective.choix >= 0
      && reponseEffective.choix < (question.choix?.length ?? 0);
    const reponseLibreValide = reponseEffective.type === "texte"
      ? Boolean(reponseEffective.texte.trim())
      : reponseEffective.type === "audio" && reponseEffective.audio.size > 0;
    const sansReponse = reponseEffective.type === "sans_reponse";
    if (!sansReponse && (question.typeReponse === "choix" && !choixValide
      || question.typeReponse === "texte" && (reponseEffective.type !== "texte" || !reponseLibreValide)
      || question.typeReponse === "audio" && (reponseEffective.type !== "audio" || !reponseLibreValide))) {
      throw new ApiError(422, "La réponse sélectionnée est invalide.");
    }

    if (question.typeReponse !== "choix") await analyseSimulee();
    const correcte = reponseEffective.type === "choix" && reponseEffective.choix === question.bonneReponse;
    // La dictée et le texte à trous sont corrigés exactement ; l'oral reste à évaluer par le service STT (phase 4).
    const juste = sansReponse ? false : question.reponseAttendue
      ? reponseEffective.type === "texte"
        ? normaliser(reponseEffective.texte) === normaliser(question.reponseAttendue)
        : reponseEffective.type === "audio"
          ? true // La transcription STT n'existe pas encore : phase 1, on valide l'enregistrement.
          : false
      : question.typeReponse === "texte"
        ? reponseLibreValide
        : question.typeReponse === "audio" ? reponseLibreValide : correcte;
    const points = Number(juste) * POINTS_PAR_EXERCICE;
    session.bonnes += Number(juste);
    session.score += points;
    session.scoresCompetences[question.competence].total += POINTS_PAR_EXERCICE;
    session.scoresCompetences[question.competence].score += points;
    session.niveauxVises.push(session.niveauVise);
    const donnee: DonneeAnalyse = {
      idQuestion: question.id,
      competence: question.competence,
      format: formatDe(question),
      difficulte: Math.max(1, session.niveaux.indexOf(question.niveau) + 1),
      justesse: juste,
      tempsReponseSecondes: Math.max(0, Math.round((Date.now() - session.debutQuestion) / 1000)),
    };
    // La transcription et la confiance STT seront ajoutées quand le service de voix existera (phase 4).
    session.donneesAnalyse.push(donnee);
    // Seules les réponses à choix font évoluer le niveau estimé
    if (question.typeReponse === "choix") {
      session.niveauVise = Math.max(0, Math.min(session.niveaux.length - 1, session.niveauVise + (juste ? 1 : -1)));
    }

    const suivante = choisirQuestion(session);
    if (suivante) {
      session.questionCourante = suivante;
      session.dejaPosees.add(suivante.id);
      session.debutQuestion = Date.now();
    } else {
      session.terminee = true;
    }

    const suite = {
      numeroQuestion: session.niveauxVises.length,
      totalQuestions: session.total / POINTS_PAR_EXERCICE,
      questionSuivante: suivante ? sansCorrection(suivante) : null,
      resultat: suivante ? null : calculerResultat(session),
    };
    const retour: RetourReponse = sansReponse
      ? { ...suite, typeReponse: "en_attente" }
      : question.typeReponse === "choix"
        ? { ...suite, typeReponse: "choix", correcte, bonneReponse: question.bonneReponse ?? 0 }
        : {
          ...suite,
          typeReponse: question.typeReponse,
          evaluation: formatDe(question) === "parler"
            ? `Enregistrement reçu. Phrase attendue : « ${question.reponseAttendue} ». Analyse vocale à venir.`
            : juste ? "Bonne réponse." : `Réponse incorrecte. Attendu : ${question.reponseAttendue ?? "—"}.`,
        };
    session.derniereReponse = { idQuestion, reponse, retour };
    return retour;
  },

  /** Fin anticipée (temps écoulé) : résultat d'après les réponses déjà données. */
  async terminer(idSession: string): Promise<IssueTerminaison> {
    const session = sessions.get(idSession);
    if (!session) throw new ApiError(404, "Session de test introuvable.");
    session.terminee = true;
    await analyseSimulee();
    return { statut: "termine", resultat: calculerResultat(session) };
  },

  /*
   * Démonstration : le test adaptatif simulé choisit ses questions au fil des réponses et ne vit qu'en mémoire.
   * La reprise après un rechargement passe par le store (sessionStorage) ; la reprise depuis le serveur
   * (onglet fermé, autre appareil) n'existe qu'avec le backend.
   */
  async testEnCours(): Promise<TestInterrompu | null> {
    return null;
  },

  async abandonner(idSession: string): Promise<void> {
    const session = sessions.get(idSession);
    if (session) session.terminee = true;
  },
};
