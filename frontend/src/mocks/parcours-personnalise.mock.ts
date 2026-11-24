/*
 * Parcours personnalisé simulé (preset NEXT_PUBLIC_MODE=demo), au format des réponses attendues du backend.
 * L'avancement est gardé en mémoire le temps de la session (répondre aux exercices de la leçon du jour fait
 * avancer la leçon atteinte). Le contenu est choisi dans `parcours-langues.ts` selon la langue du test simulé
 * terminé, sinon selon le parcours réel de l'apprenant (fr, en, it, de, zh) ; le français reste le défaut des tests
 * et de la démo sans backend ni test terminé.
 * Scénario de départ : NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO (par défaut « passif »).
 */
import { ApiError } from "@/lib/api-client";
import { ERREURS_FREQUENTES, repererErreurs } from "@/lib/corrections-messages";
import { delay } from "@/mocks/delay";
import { packParcoursMock, PACKS_PARCOURS_MOCK, type CodeLangueParcoursMock } from "@/mocks/parcours-langues";
import type {
  CorrectionExerciceDto,
  CorrectionSepareeChatbotDto,
  ExerciceCibleChatbotDto,
  ExerciceParcoursDto,
  LeconParcoursDto,
  MessageChatbotDto,
  ParcoursPersonnaliseDto,
  RecommandationParcoursDto,
  ReponseChatbotDto,
  TraductionSepareeChatbotDto,
} from "@/services/parcours-personnalise.mapper";
import type { ReponseExercice } from "@/types/parcours-personnalise";

export type ScenarioParcoursMock =
  | "passif" // leçon 23, phase passive
  | "actif" // leçon 56, phase active, leçon de révision
  | "sans-parcours" // 404 : test de positionnement pas encore passé
  | "exercices-indisponibles" // le parcours se charge, les exercices échouent
  | "erreur-serveur";

const SCENARIOS: ScenarioParcoursMock[] = ["passif", "actif", "sans-parcours", "exercices-indisponibles", "erreur-serveur"];

const scenarioConfigure = process.env.NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO;
if (scenarioConfigure && !SCENARIOS.includes(scenarioConfigure as ScenarioParcoursMock)) {
  throw new Error(`Scénario de parcours simulé inconnu : ${scenarioConfigure}`);
}

const ID_PARCOURS = 7;
/** Même seuil que celui proposé au backend pour déduire le statut du score. */
const SEUIL_REUSSITE = 50;
const LECONS_PAR_MODULE = 7;
const RANGS = ["choix", "texte", "ecoute", "prononciation", "conversation", "redaction"] as const;

/* ---------- Langue du parcours simulé (alignée sur le parcours réel de l'apprenant) ---------- */

let codeLangue: CodeLangueParcoursMock = "fr";
const pack = () => PACKS_PARCOURS_MOCK[codeLangue];
const DERNIERE_LECON = PACKS_PARCOURS_MOCK.fr.modules.length * LECONS_PAR_MODULE;

/** Choisis la langue des contenus simulés. Un code inconnu laisse le français. */
export function choisirLangueParcoursMock(langue: string | undefined | null): CodeLangueParcoursMock {
  codeLangue = packParcoursMock(langue).code;
  return codeLangue;
}

export function langueParcoursMockActuelle(): CodeLangueParcoursMock {
  return codeLangue;
}

/* ---------- Banque de contenus (exercice.contenu), choisie selon la langue et le numéro de leçon ---------- */

interface ExerciceMock {
  ligne: Omit<ExerciceParcoursDto, "statut" | "score_obtenu">;
  contenu: Record<string, unknown>;
  /** Réponses acceptées (formats choix, texte, écoute) ou phrase attendue (prononciation). */
  attendu: string[];
  /** Raison de la bonne réponse, renvoyée avec la correction automatique. */
  explication?: string;
}

function exerciceMock(lecon: number, rang: number): ExerciceMock {
  const id = lecon * 10 + rang + 1;
  const pick = <T,>(liste: readonly T[]) => liste[(lecon + rang) % liste.length];
  const base = { id_parcours_exercice: id, id_exercice: 1000 + id, numero_lecon: lecon, difficulte: Math.min(5, 1 + Math.floor(lecon / 12)) };
  const contenus = pack();
  switch (RANGS[rang]) {
    case "choix": {
      const c = pick(contenus.choix);
      return { ligne: { ...base, type: c.type, intitule: c.intitule }, contenu: { format: "choix", consigne: c.consigne, enonce: c.enonce, choix: [...c.choix] }, attendu: [c.reponse], explication: c.explication };
    }
    case "texte": {
      const t = pick(contenus.textes);
      return { ligne: { ...base, type: "VOCABULAIRE", intitule: t.intitule }, contenu: { format: "texte", consigne: t.consigne, enonce: t.enonce }, attendu: [...t.reponses], explication: t.explication };
    }
    case "ecoute": {
      const e = pick(contenus.ecoutes);
      return {
        ligne: { ...base, type: "ECOUTE", intitule: e.intitule },
        contenu: { format: "ecoute", consigne: contenus.messages.consigneEcoute, question: e.question, choix: [...e.choix], audio_url: null, texte_audio: e.texte },
        attendu: [e.reponse],
        explication: e.explication,
      };
    }
    case "prononciation": {
      const p = pick(contenus.prononciations);
      return { ligne: { ...base, type: "ORAL", intitule: p.intitule }, contenu: { format: "prononciation", consigne: contenus.messages.consignePrononciation, phrase: p.phrase }, attendu: [p.phrase] };
    }
    case "redaction": {
      const r = pick(contenus.redactions);
      // Le backend n'a pas encore de type « expression écrite » : la rédaction est rangée en grammaire
      return {
        ligne: { ...base, type: "GRAMMAIRE", intitule: `Expression écrite : ${r.intitule.toLowerCase()}` },
        contenu: { format: "redaction", consigne: contenus.messages.consigneRedaction, enonce: r.enonce, mots_minimum: 25 },
        attendu: [],
      };
    }
    default: {
      const c = pick(contenus.conversations);
      return {
        ligne: { ...base, type: "ORAL", intitule: c.intitule },
        contenu: { format: "conversation", consigne: contenus.messages.consigneConversation, sujet: c.sujet, message_initial: c.message_initial, echanges_minimum: 3 },
        attendu: [],
      };
    }
  }
}

/* ---------- Avancement (en mémoire) ---------- */

let scenario: ScenarioParcoursMock = (scenarioConfigure as ScenarioParcoursMock | undefined) ?? "passif";
let leconAtteinte = 0;
const scores = new Map<number, number>();
/** Recommandation « persistée » le temps de la session de démonstration, comme dans parcours.recommandation_ia. */
let recommandationDemo: RecommandationParcoursDto | null = null;

function enveloppeRecommandation(): RecommandationParcoursDto {
  const contenus = pack();
  return {
    statut: "COMPLET",
    code_langue: contenus.code,
    referentiel: contenus.cadre,
    niveau_cible: contenus.cadre === "HSK" ? "HSK 3" : "B1",
    recommandations: contenus.recommandations.map((action, index) => ({ ...action, priorite: index + 1 })),
    resume: contenus.resumeRecommandation,
    confiance: 0.78,
  };
}

function initialiser() {
  leconAtteinte = scenario === "actif" ? 56 : 23;
  scores.clear();
  recommandationDemo = null;
  for (let lecon = 1; lecon <= leconAtteinte; lecon++) {
    for (let rang = 0; rang < RANGS.length; rang++) {
      const id = lecon * 10 + rang + 1;
      // Leçons passées : tout est fait, quelques exercices à revoir ; leçon du jour : seul le premier est fait
      if (lecon < leconAtteinte) scores.set(id, lecon % 4 === 0 && rang === 1 ? 40 : 60 + ((lecon + rang) % 5) * 10);
      else if (rang === 0) scores.set(id, 90);
    }
  }
}
initialiser();

/** Change de scénario et remet l'avancement à zéro (tests, démonstration). Le français reste le défaut. */
export function choisirScenarioParcoursMock(choix: ScenarioParcoursMock, langue: string = "fr") {
  scenario = choix;
  choisirLangueParcoursMock(langue);
  initialiser();
}

const statutDe = (score: number | undefined) => (score === undefined ? "A_FAIRE" : score >= SEUIL_REUSSITE ? "REUSSI" : "A_REVOIR");

function ligneAvecStatut({ ligne }: ExerciceMock): ExerciceParcoursDto {
  const score = scores.get(ligne.id_parcours_exercice);
  return { ...ligne, statut: statutDe(score), score_obtenu: score ?? null };
}

async function repondre() {
  await delay(300);
  if (scenario === "sans-parcours") throw new ApiError(404, "Aucun parcours", "Aucun parcours en cours.");
  if (scenario === "erreur-serveur") throw new ApiError(500, "Erreur serveur");
}

async function repondreExercices(idParcours: number) {
  await repondre();
  if (scenario === "exercices-indisponibles") throw new ApiError(503, "Service indisponible");
  if (idParcours !== ID_PARCOURS) throw new ApiError(404, "Parcours introuvable");
}

/** Compare sans accents, majuscules, apostrophes ni ponctuation (conserve les caractères chinois). */
export function normaliserReponse(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Part des mots de la phrase attendue retrouvés dans la transcription, en pourcentage. */
export function scorePrononciation(attendue: string, dite: string): number {
  const cible = normaliserReponse(attendue);
  const dictee = normaliserReponse(dite);
  // Le mandarin ne sépare pas les mots : on compare les caractères.
  const elements = cible.includes(" ") ? cible.split(" ") : [...cible];
  const entendus = new Set(dictee.includes(" ") ? dictee.split(" ") : [...dictee]);
  if (elements.length === 0) return 0;
  return Math.round((elements.filter((element) => entendus.has(element)).length / elements.length) * 100);
}

/** Même règle que backend/app/services/phase_parcours.py : passive jusqu'à la leçon 49, active ensuite. */
const phaseDe = (lecon: number) => (lecon < 50 ? "PASSIVE" : "ACTIVE");

/** Phase passive : seules les erreurs essentielles sont relevées (contrat v2, US157). */
export const ERREURS_MAX_PHASE_PASSIVE = 3;

/**
 * Professeur IA simulé pour une rédaction : longueur, majuscule, ponctuation finale et erreurs fréquentes.
 * Même forme de réponse que la correction par le LLM (contrat v2, US157) : le retour dépend de la phase de la leçon
 * atteinte — en phase passive, les erreurs essentielles seulement ; en phase active, toutes les erreurs et le texte
 * entièrement corrigé (`reformulation`). Le score, lui, ne dépend que du texte.
 */
export function corrigerRedaction(
  texte: string,
  motsMinimum: number,
  leconAtteinte: number,
  codeLangue: string = langueParcoursMockActuelle(),
): Omit<CorrectionExerciceDto, "statut"> {
  const contenus = packParcoursMock(codeLangue);
  const { messages } = contenus;
  const estFrancais = contenus.code === "fr";
  const phase = phaseDe(leconAtteinte);
  const propre = texte.trim();
  const mots = propre.split(/\s+/).filter(Boolean);
  // Le mandarin ne sépare pas les mots : on compte les caractères chinois pour la longueur.
  const nombre = estFrancais || contenus.code !== "zh"
    ? mots.length
    : [...propre].filter((caractere) => /\p{Script=Han}/u.test(caractere)).length;
  const erreurs: NonNullable<CorrectionExerciceDto["erreurs"]> = [];

  if (estFrancais) {
    for (const { motif, correction, explication } of ERREURS_FREQUENTES) {
      const trouve = propre.match(motif);
      if (trouve) erreurs.push({ extrait: trouve[0], correction, explication });
    }
  }
  // Le mandarin n'a pas de majuscules : seul le point final est contrôlé.
  if (contenus.code !== "zh" && (estFrancais ? /^[a-zà-ÿ]/ : /^\p{Ll}/u).test(propre)) {
    erreurs.push({
      extrait: mots[0],
      correction: mots[0].charAt(0).toUpperCase() + mots[0].slice(1),
      explication: messages.majusculeExplication,
    });
  }
  if (!/[.!?…。！？]$/.test(propre)) {
    erreurs.push({ extrait: mots.at(-1) ?? "", correction: `${mots.at(-1) ?? ""}${messages.pointFinal}`, explication: messages.pointExplication });
  }

  const pointsForts: string[] = [];
  if (nombre >= motsMinimum) pointsForts.push(messages.texteDeveloppe(nombre));
  if (estFrancais) {
    if (/\b(mais|parce que|donc|puis|ensuite|car|alors)\b/i.test(propre)) pointsForts.push("Vous reliez vos idées avec des connecteurs (mais, parce que, ensuite…).");
    if (/\b(ai|as|a|avons|avez|ont|suis|es|est|sommes|êtes|sont)\s+\p{L}+(é|i|is|it|u)e?s?\b/iu.test(propre)) pointsForts.push("Vous employez le passé composé.");
  }

  const manque = Math.max(0, motsMinimum - nombre);
  const score = Math.max(0, Math.min(100, 100 - erreurs.length * 15 - Math.ceil((manque / motsMinimum) * 50)));

  // Phase active : le texte entièrement corrigé, pour que l'apprenant compare avec le sien
  let reformulation: string | null = null;
  if (phase === "ACTIVE" && erreurs.length > 0) {
    reformulation = estFrancais
      ? ERREURS_FREQUENTES.reduce((t, { motif, correction }) => t.replace(motif, correction), propre)
      : propre;
    reformulation = reformulation.charAt(0).toUpperCase() + reformulation.slice(1);
    if (!/[.!?…。！？]$/.test(reformulation)) reformulation += messages.pointFinal;
  }

  return {
    score_obtenu: score,
    mode_correction: "IA",
    phase,
    lecon_atteinte: leconAtteinte,
    reformulation,
    commentaire: score >= 80 ? messages.texteBon : score >= SEUIL_REUSSITE ? messages.texteMoyen : messages.texteFaible,
    points_forts: pointsForts,
    erreurs: phase === "PASSIVE" ? erreurs.slice(0, ERREURS_MAX_PHASE_PASSIVE) : erreurs,
    conseil:
      manque > 0
        ? messages.texteManque(motsMinimum, manque)
        : erreurs.length > 0
          ? phase === "PASSIVE"
            ? messages.conseilRelire
            : messages.conseilComparer
          : messages.conseilOpinion,
  };
}

/** Traduction et explication de démonstration : une paire par réponse du tuteur, sans modèle de langue. */
function traductionDemo(reponse: string): { traduction: string; explication: string } {
  const { messages } = pack();
  return { traduction: messages.traductionPrefix(reponse), explication: messages.traductionExplication };
}

export const parcoursPersonnaliseMock = {
  async enCours(): Promise<ParcoursPersonnaliseDto> {
    await repondre();
    const contenus = pack();
    return {
      id_parcours: ID_PARCOURS,
      statut: "EN_COURS",
      date_creation: "2026-10-02T09:30:00Z",
      code_langue: contenus.code,
      libelle_langue: contenus.libelle,
      cadre: contenus.cadre,
      niveaux_cadre: [...contenus.niveaux],
      niveau_depart: contenus.cadre === "HSK" ? "HSK 2" : "A2",
      niveau_vise: contenus.cadre === "HSK" ? "HSK 3" : "B1",
      lecon_atteinte: leconAtteinte,
      phase: phaseDe(leconAtteinte),
      est_lecon_de_revision: leconAtteinte >= 50 && leconAtteinte % 7 === 0,
      modules: contenus.modules.map((m, i) => ({
        ...m,
        numero: i + 1,
        premiere_lecon: i * LECONS_PAR_MODULE + 1,
        derniere_lecon: (i + 1) * LECONS_PAR_MODULE,
      })),
      recommandation: recommandationDemo,
    };
  },

  async exercices(idParcours: number): Promise<ExerciceParcoursDto[]> {
    await repondreExercices(idParcours);
    return Array.from({ length: leconAtteinte }, (_, l) => RANGS.map((__, rang) => ligneAvecStatut(exerciceMock(l + 1, rang)))).flat();
  },

  async lecon(idParcours: number, numero: number): Promise<LeconParcoursDto> {
    await repondreExercices(idParcours);
    if (numero < 1 || numero > DERNIERE_LECON) throw new ApiError(404, "Leçon introuvable", "Cette leçon n'existe pas.");
    if (numero > leconAtteinte) {
      throw new ApiError(403, "Leçon à venir", "Cette leçon s'ouvrira quand vous aurez terminé les leçons précédentes.");
    }
    return {
      numero_lecon: numero,
      est_lecon_de_revision: numero >= 50 && numero % 7 === 0,
      code_langue: pack().code,
      exercices: RANGS.map((_, rang) => {
        const exercice = exerciceMock(numero, rang);
        return { ...ligneAvecStatut(exercice), contenu: JSON.stringify(exercice.contenu) };
      }),
    };
  },

  async corriger(idParcours: number, idParcoursExercice: number, reponse: ReponseExercice): Promise<CorrectionExerciceDto> {
    await repondreExercices(idParcours);
    const lecon = Math.floor(idParcoursExercice / 10);
    const rang = (idParcoursExercice % 10) - 1;
    if (lecon > leconAtteinte || !RANGS[rang]) throw new ApiError(403, "Exercice indisponible");
    const exercice = exerciceMock(lecon, rang);

    const { messages } = pack();
    let correction: Omit<CorrectionExerciceDto, "statut">;
    if (reponse.format === "conversation") {
      const contenu = exercice.contenu as { echanges_minimum: number };
      const tours = reponse.messages.filter((m) => m.role === "apprenant").length;
      const score = Math.min(100, Math.round((tours / contenu.echanges_minimum) * 100));
      correction = {
        score_obtenu: score,
        mode_correction: "IA",
        phase: phaseDe(leconAtteinte),
        lecon_atteinte: leconAtteinte,
        commentaire: score >= SEUIL_REUSSITE ? messages.conversationOk : messages.conversationKo,
        points_forts: tours > 0 ? [messages.pointFortConversation] : [],
        conseil: messages.conseilConversation,
      };
    } else if (reponse.format === "redaction") {
      correction = corrigerRedaction(reponse.reponse, (exercice.contenu as { mots_minimum: number }).mots_minimum, leconAtteinte);
    } else if (reponse.format === "prononciation") {
      const score = scorePrononciation(exercice.attendu[0], reponse.reponse);
      correction = {
        score_obtenu: score,
        mode_correction: "AUTOMATIQUE",
        commentaire:
          score >= 80 ? messages.prononciationBon : score >= SEUIL_REUSSITE ? messages.prononciationMoyen : messages.prononciationFaible,
      };
    } else {
      // Correction déterministe (US43-BE) : comparaison avec la réponse attendue, jamais envoyée avant la réponse
      const juste = exercice.attendu.some((a) => normaliserReponse(a) === normaliserReponse(reponse.reponse));
      correction = {
        score_obtenu: juste ? 100 : 0,
        mode_correction: "AUTOMATIQUE",
        commentaire: juste ? messages.bonneReponse : messages.mauvaiseReponse,
        reponse_attendue: juste ? null : exercice.attendu[0],
        explication: exercice.explication ?? null,
      };
    }

    scores.set(idParcoursExercice, correction.score_obtenu);
    // Leçon du jour terminée (tous les exercices ont une réponse) : la leçon suivante s'ouvre
    const tousFaits = RANGS.every((_, r) => scores.has(lecon * 10 + r + 1));
    if (lecon === leconAtteinte && tousFaits && leconAtteinte < DERNIERE_LECON) leconAtteinte += 1;

    return { statut: statutDe(correction.score_obtenu), ...correction };
  },

  /** Recommandations simulées : même enveloppe que le backend, conservée jusqu'au changement de scénario. */
  async recommandations(idParcours: number): Promise<RecommandationParcoursDto> {
    await repondre();
    if (idParcours !== ID_PARCOURS) throw new ApiError(404, "Parcours introuvable");
    recommandationDemo = enveloppeRecommandation();
    return recommandationDemo;
  },

  /** Tuteur IA simulé : réagit puis relance avec une question liée au sujet de la conversation. */
  async chatbot({ message, historique }: MessageChatbotDto): Promise<ReponseChatbotDto> {
    await delay(500);
    const contenus = pack();
    const conversation = contenus.conversations.find((c) => c.message_initial === historique[0]?.contenu) ?? contenus.conversations[0];
    const tour = historique.filter((m) => m.role === "apprenant").length;
    // Les règles de `repererErreurs` sont spécifiques au français ; on ne les applique qu'à ce paquet.
    const corrections = contenus.code === "fr" ? repererErreurs(message).slice(0, 3) : [];
    if (normaliserReponse(message).split(" ").length < 2) {
      const reponse = contenus.messages.reponseCourte;
      return { reponse, corrections, ...traductionDemo(reponse) };
    }
    const reaction = contenus.messages.reactions[tour % contenus.messages.reactions.length];
    const relance = conversation.relances[tour] ?? contenus.messages.relanceFin;
    const reponse = `${reaction} ${relance}`;
    return { reponse, corrections, ...traductionDemo(reponse) };
  },

  /** Correction séparée simulée : même détection d'erreurs, contrat public du relais backend. */
  async corrigerChatbot({ message }: MessageChatbotDto): Promise<CorrectionSepareeChatbotDto> {
    await delay(200);
    const corrections = pack().code === "fr" ? repererErreurs(message) : [];
    return {
      corrections: corrections.slice(0, 3).map((correction) => ({ type: "grammaire" as const, ...correction })),
      version_prompt: "chatbot/correction@1.0.0",
    };
  },

  /** Traduction séparée simulée : l'identifiant de message est renvoyé tel quel. */
  async traduireChatbot(idMessage: string, message: string): Promise<TraductionSepareeChatbotDto> {
    await delay(200);
    return {
      id_message: idMessage,
      ...traductionDemo(message),
      version_prompt: "chatbot/traduction@1.0.0",
    };
  },

  /** Exercice ciblé simulé : aucun LLM, mais la même forme que le contrat public backend. */
  async exerciceChatbot(typeErreur: string, erreur: string): Promise<ExerciceCibleChatbotDto> {
    await delay(200);
    const { messages } = pack();
    return {
      id_exercice: 901,
      enonce: messages.exerciceCibleEnonce(erreur),
      consigne: messages.exerciceCibleConsigne(typeErreur),
      descripteur_id: messages.descripteurId,
      niveau: pack().cadre === "HSK" ? "HSK 1" : "A1",
    };
  },
};
