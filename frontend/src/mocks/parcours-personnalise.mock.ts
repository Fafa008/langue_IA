/*
 * Parcours personnalisé simulé (NEXT_PUBLIC_API_MOCK=true), au format des réponses attendues du backend.
 * Démo sans backend : l'avancement est gardé en mémoire le temps de la session (répondre aux exercices
 * de la leçon du jour fait avancer la leçon atteinte), et le chatbot répond par des règles simples.
 * Scénario de départ : NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO (par défaut « passif »).
 */
import { ApiError } from "@/lib/api-client";
import { repererErreurs } from "@/lib/corrections-messages";
import { delay } from "@/mocks/delay";
import type {
  CorrectionExerciceDto,
  CorrectionSepareeChatbotDto,
  ExerciceCibleChatbotDto,
  ExerciceParcoursDto,
  LeconParcoursDto,
  MessageChatbotDto,
  ModuleParcoursDto,
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

const MODULES: Omit<ModuleParcoursDto, "numero" | "premiere_lecon" | "derniere_lecon">[] = [
  { titre: "Premiers contacts", description: "Saluer, se présenter, épeler son nom." },
  { titre: "Vie quotidienne", description: "Parler de sa journée, de sa famille et de son logement." },
  { titre: "Se déplacer et s'orienter", description: "Demander son chemin, prendre les transports." },
  { titre: "Loisirs et goûts", description: "Exprimer ses goûts, proposer une sortie." },
  { titre: "Travail et études", description: "Parler de son métier, de sa formation et de ses projets." },
  { titre: "Santé et bien-être", description: "Décrire un symptôme, prendre rendez-vous." },
  { titre: "Société et actualité", description: "Comprendre une information et réagir." },
  { titre: "S'exprimer et argumenter", description: "Donner son opinion, nuancer, convaincre." },
];
const DERNIERE_LECON = MODULES.length * LECONS_PAR_MODULE;

/* ---------- Banque de contenus (exercice.contenu), choisie selon le numéro de leçon ---------- */

const CHOIX = [
  { type: "GRAMMAIRE", intitule: "Le passé composé", consigne: "Choisissez la bonne forme.", enonce: "Hier, je ___ au cinéma.", choix: ["vais", "suis allé", "irai"], reponse: "suis allé", explication: "« Hier » situe l'action dans le passé : on emploie le passé composé, avec l'auxiliaire être pour « aller »." },
  { type: "GRAMMAIRE", intitule: "Le futur proche", consigne: "Choisissez la bonne forme.", enonce: "Ce soir, nous ___ dîner chez des amis.", choix: ["allons", "sommes allés", "allions"], reponse: "allons", explication: "« Ce soir » annonce un futur proche : aller au présent + infinitif (« nous allons dîner »)." },
  { type: "COMPREHENSION", intitule: "Lire une annonce", consigne: "« Le musée est ouvert du mardi au dimanche, de 10 h à 18 h. »", enonce: "Peut-on visiter le musée le lundi ?", choix: ["Oui", "Non", "Seulement le matin"], reponse: "Non", explication: "Le musée ouvre du mardi au dimanche : il est donc fermé le lundi." },
  { type: "COMPREHENSION", intitule: "Comprendre un message", consigne: "« Rendez-vous devant la gare à 9 h, ne sois pas en retard ! »", enonce: "Où est le rendez-vous ?", choix: ["À la gare", "Au café", "À l'école"], reponse: "À la gare", explication: "Le message dit « devant la gare »." },
] as const;

const TEXTES = [
  { intitule: "Les salutations", consigne: "Complétez la phrase.", enonce: "___, je m'appelle Marie.", reponses: ["Bonjour", "Bonsoir", "Salut"], explication: "On ouvre une présentation par une salutation : « Bonjour », « Bonsoir » ou « Salut »." },
  { intitule: "Prendre rendez-vous", consigne: "Complétez avec le bon verbe.", enonce: "Je voudrais ___ un rendez-vous chez le médecin.", reponses: ["prendre"], explication: "On dit « prendre un rendez-vous »." },
  { intitule: "Demander poliment", consigne: "Complétez avec « pouvoir » au conditionnel.", enonce: "___-vous m'indiquer la gare, s'il vous plaît ?", reponses: ["Pourriez"], explication: "« Pouvoir » au conditionnel avec « vous » : « pourriez ». Le conditionnel rend la demande polie." },
  { intitule: "Au restaurant", consigne: "Complétez la commande.", enonce: "Je ___ un café, s'il vous plaît.", reponses: ["voudrais", "veux", "prends"], explication: "« Je voudrais » (conditionnel) est la forme la plus polie pour commander." },
];

const ECOUTES = [
  { intitule: "Un message vocal", texte: "Bonjour, c'est Paul. Je serai en retard de dix minutes. À tout à l'heure !", question: "Que dit Paul ?", choix: ["Il annule le rendez-vous", "Il sera en retard", "Il est déjà arrivé"], reponse: "Il sera en retard", explication: "Paul dit : « Je serai en retard de dix minutes »." },
  { intitule: "À la gare", texte: "Le train pour Lyon partira du quai numéro trois à quatorze heures.", question: "De quel quai part le train ?", choix: ["Quai 1", "Quai 3", "Quai 14"], reponse: "Quai 3", explication: "L'annonce dit « quai numéro trois » ; quatorze heures est l'horaire." },
  { intitule: "La météo", texte: "Demain, il pleuvra le matin, puis le soleil reviendra l'après-midi.", question: "Quel temps fera-t-il demain après-midi ?", choix: ["Pluie", "Soleil", "Neige"], reponse: "Soleil", explication: "« Le soleil reviendra l'après-midi » ; la pluie, c'est le matin." },
];

const PRONONCIATIONS = [
  { intitule: "Se présenter", phrase: "Bonjour, je m'appelle Marie et j'habite à Paris." },
  { intitule: "Commander", phrase: "Je voudrais un café et un croissant, s'il vous plaît." },
  { intitule: "Demander son chemin", phrase: "Excusez-moi, où se trouve la gare ?" },
];

const CONVERSATIONS = [
  {
    intitule: "Faire connaissance",
    sujet: "Se présenter",
    message_initial: "Bonjour ! Je suis votre tuteur IA. Comment vous appelez-vous ?",
    relances: ["Enchanté ! D'où venez-vous ?", "Et que faites-vous dans la vie ?", "Qu'aimez-vous faire le week-end ?"],
  },
  {
    intitule: "Au restaurant",
    sujet: "Commander un repas",
    message_initial: "Bonsoir et bienvenue ! Vous avez choisi votre plat ?",
    relances: ["Très bon choix. Et comme boisson ?", "Vous prendrez un dessert ?", "Parfait. Vous payez par carte ou en espèces ?"],
  },
  {
    intitule: "Organiser une sortie",
    sujet: "Proposer une activité",
    message_initial: "Salut ! On sort ce week-end ? Qu'est-ce que tu proposes ?",
    relances: ["Bonne idée ! Quel jour te convient ?", "À quelle heure on se retrouve ?", "Où est-ce qu'on se donne rendez-vous ?"],
  },
];

const REDACTIONS = [
  { intitule: "Raconter son week-end", enonce: "Racontez votre dernier week-end en quelques phrases : où étiez-vous, avec qui, qu'avez-vous fait ?" },
  { intitule: "Écrire à un ami", enonce: "Écrivez un court message à un ami pour lui proposer une sortie samedi." },
  { intitule: "Décrire sa ville", enonce: "Décrivez votre ville ou votre quartier : ce que vous aimez et ce que vous aimez moins." },
];

import { ERREURS_FREQUENTES } from "@/lib/corrections-messages";

const RANGS = ["choix", "texte", "ecoute", "prononciation", "conversation", "redaction"] as const;

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
  switch (RANGS[rang]) {
    case "choix": {
      const c = pick(CHOIX);
      return { ligne: { ...base, type: c.type, intitule: c.intitule }, contenu: { format: "choix", consigne: c.consigne, enonce: c.enonce, choix: c.choix }, attendu: [c.reponse], explication: c.explication };
    }
    case "texte": {
      const t = pick(TEXTES);
      return { ligne: { ...base, type: "VOCABULAIRE", intitule: t.intitule }, contenu: { format: "texte", consigne: t.consigne, enonce: t.enonce }, attendu: t.reponses, explication: t.explication };
    }
    case "ecoute": {
      const e = pick(ECOUTES);
      return {
        ligne: { ...base, type: "ECOUTE", intitule: e.intitule },
        contenu: { format: "ecoute", consigne: "Écoutez l'extrait, puis répondez.", question: e.question, choix: e.choix, audio_url: null, texte_audio: e.texte },
        attendu: [e.reponse],
        explication: e.explication,
      };
    }
    case "prononciation": {
      const p = pick(PRONONCIATIONS);
      return { ligne: { ...base, type: "ORAL", intitule: p.intitule }, contenu: { format: "prononciation", consigne: "Lisez la phrase à voix haute.", phrase: p.phrase }, attendu: [p.phrase] };
    }
    case "redaction": {
      const r = pick(REDACTIONS);
      // Le backend n'a pas encore de type « expression écrite » : la rédaction est rangée en grammaire
      return {
        ligne: { ...base, type: "GRAMMAIRE", intitule: `Expression écrite : ${r.intitule.toLowerCase()}` },
        contenu: { format: "redaction", consigne: "Rédigez votre réponse ; le professeur IA la corrigera.", enonce: r.enonce, mots_minimum: 25 },
        attendu: [],
      };
    }
    default: {
      const c = pick(CONVERSATIONS);
      return {
        ligne: { ...base, type: "ORAL", intitule: c.intitule },
        contenu: { format: "conversation", consigne: "Discutez avec le tuteur IA, à l'écrit ou à la voix.", sujet: c.sujet, message_initial: c.message_initial, echanges_minimum: 3 },
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
  return {
    statut: "COMPLET",
    code_langue: "fr",
    referentiel: "CECRL",
    niveau_cible: "B1",
    recommandations: [
      {
        domaine: "grammaire",
        type_exercice: "GRAMMAIRE",
        action: "Refaire un exercice sur le passé composé des verbes irréguliers.",
        justification: "Les formes au passé composé sont encore hésitantes dans vos réponses.",
        priorite: 1,
      },
      {
        domaine: "vocabulaire",
        type_exercice: "VOCABULAIRE",
        action: "Réviser le vocabulaire des déplacements et des directions.",
        justification: "Quelques mots du champ lexical du trajet manquent.",
        priorite: 2,
      },
    ],
    resume: "Deux actions courtes : conjugaison puis vocabulaire des déplacements.",
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

/** Change de scénario et remet l'avancement à zéro (tests, démonstration). */
export function choisirScenarioParcoursMock(choix: ScenarioParcoursMock) {
  scenario = choix;
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

/** Compare sans accents, majuscules, apostrophes ni ponctuation. */
export function normaliserReponse(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Part des mots de la phrase attendue retrouvés dans la transcription, en pourcentage. */
export function scorePrononciation(attendue: string, dite: string): number {
  const mots = normaliserReponse(attendue).split(" ");
  const dits = new Set(normaliserReponse(dite).split(" "));
  return Math.round((mots.filter((m) => dits.has(m)).length / mots.length) * 100);
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
export function corrigerRedaction(texte: string, motsMinimum: number, leconAtteinte: number): Omit<CorrectionExerciceDto, "statut"> {
  const phase = phaseDe(leconAtteinte);
  const propre = texte.trim();
  const mots = propre.split(/\s+/).filter(Boolean);
  const erreurs: NonNullable<CorrectionExerciceDto["erreurs"]> = [];

  for (const { motif, correction, explication } of ERREURS_FREQUENTES) {
    const trouve = propre.match(motif);
    if (trouve) erreurs.push({ extrait: trouve[0], correction, explication });
  }
  if (/^[a-zà-ÿ]/.test(propre)) {
    erreurs.push({ extrait: mots[0], correction: mots[0].charAt(0).toUpperCase() + mots[0].slice(1), explication: "Une phrase commence par une majuscule." });
  }
  if (!/[.!?…]$/.test(propre)) {
    erreurs.push({ extrait: mots.at(-1) ?? "", correction: `${mots.at(-1) ?? ""}.`, explication: "Terminez chaque phrase par un point." });
  }

  const pointsForts: string[] = [];
  if (mots.length >= motsMinimum) pointsForts.push(`Texte assez développé (${mots.length} mots).`);
  if (/\b(mais|parce que|donc|puis|ensuite|car|alors)\b/i.test(propre)) pointsForts.push("Vous reliez vos idées avec des connecteurs (mais, parce que, ensuite…).");
  if (/\b(ai|as|a|avons|avez|ont|suis|es|est|sommes|êtes|sont)\s+\p{L}+(é|i|is|it|u)e?s?\b/iu.test(propre)) pointsForts.push("Vous employez le passé composé.");

  const manque = Math.max(0, motsMinimum - mots.length);
  const score = Math.max(0, Math.min(100, 100 - erreurs.length * 15 - Math.ceil((manque / motsMinimum) * 50)));

  // Phase active : le texte entièrement corrigé, pour que l'apprenant compare avec le sien
  let reformulation: string | null = null;
  if (phase === "ACTIVE" && erreurs.length > 0) {
    reformulation = ERREURS_FREQUENTES.reduce((t, { motif, correction }) => t.replace(motif, correction), propre);
    reformulation = reformulation.charAt(0).toUpperCase() + reformulation.slice(1);
    if (!/[.!?…]$/.test(reformulation)) reformulation += ".";
  }

  return {
    score_obtenu: score,
    mode_correction: "IA",
    phase,
    lecon_atteinte: leconAtteinte,
    reformulation,
    commentaire:
      score >= 80
        ? "Très bon texte, clair et bien construit."
        : score >= SEUIL_REUSSITE
          ? "Bon travail ! Quelques points sont à corriger."
          : "Votre texte doit être complété et corrigé.",
    points_forts: pointsForts,
    erreurs: phase === "PASSIVE" ? erreurs.slice(0, ERREURS_MAX_PHASE_PASSIVE) : erreurs,
    conseil:
      manque > 0
        ? `Développez davantage : écrivez au moins ${motsMinimum} mots (il en manque ${manque}).`
        : erreurs.length > 0
          ? phase === "PASSIVE"
            ? "Relisez la leçon du jour à voix haute : ces formes deviendront naturelles."
            : "Comparez votre texte à la version corrigée, puis réécrivez-le sans la regarder."
          : "Essayez maintenant d'ajouter une opinion personnelle (« À mon avis… »).",
  };
}

/** Traduction et explication de démonstration : une paire par réponse du tuteur, sans modèle de langue. */
function traductionDemo(reponse: string): { traduction: string; explication: string } {
  return {
    traduction: `Traduction française (démonstration) : « ${reponse} ».`,
    explication:
      "Explication (démonstration) : reformulez cette phrase avec vos propres mots ; un modèle de langue fournit une traduction et une explication détaillées.",
  };
}

export const parcoursPersonnaliseMock = {
  async enCours(): Promise<ParcoursPersonnaliseDto> {
    await repondre();
    return {
      id_parcours: ID_PARCOURS,
      statut: "EN_COURS",
      date_creation: "2026-10-02T09:30:00Z",
      code_langue: "fr",
      libelle_langue: "Français",
      cadre: "CECRL",
      niveaux_cadre: ["A1", "A2", "B1", "B2", "C1", "C2"],
      niveau_depart: "A2",
      niveau_vise: "B1",
      lecon_atteinte: leconAtteinte,
      phase: phaseDe(leconAtteinte),
      est_lecon_de_revision: leconAtteinte >= 50 && leconAtteinte % 7 === 0,
      modules: MODULES.map((m, i) => ({
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
      code_langue: "fr",
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
        commentaire:
          score >= SEUIL_REUSSITE
            ? "Belle conversation ! Vos réponses étaient claires et adaptées."
            : "Continuez l'échange : répondez à au moins trois questions du professeur.",
        points_forts: tours > 0 ? ["Vous avez répondu dans la langue étudiée."] : [],
        conseil: "Essayez de poser vous aussi une question au professeur.",
      };
    } else if (reponse.format === "redaction") {
      correction = corrigerRedaction(reponse.reponse, (exercice.contenu as { mots_minimum: number }).mots_minimum, leconAtteinte);
    } else if (reponse.format === "prononciation") {
      const score = scorePrononciation(exercice.attendu[0], reponse.reponse);
      correction = {
        score_obtenu: score,
        mode_correction: "AUTOMATIQUE",
        commentaire:
          score >= 80 ? "Très bonne prononciation !" : score >= SEUIL_REUSSITE ? "Bien ! Quelques mots ne sont pas reconnus." : "Réessayez en articulant chaque mot.",
      };
    } else {
      // Correction déterministe (US43-BE) : comparaison avec la réponse attendue, jamais envoyée avant la réponse
      const juste = exercice.attendu.some((a) => normaliserReponse(a) === normaliserReponse(reponse.reponse));
      correction = {
        score_obtenu: juste ? 100 : 0,
        mode_correction: "AUTOMATIQUE",
        commentaire: juste ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.",
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
    const conversation = CONVERSATIONS.find((c) => c.message_initial === historique[0]?.contenu) ?? CONVERSATIONS[0];
    const tour = historique.filter((m) => m.role === "apprenant").length;
    const corrections = repererErreurs(message).slice(0, 3);
    if (normaliserReponse(message).split(" ").length < 2) {
      const reponse = "Pouvez-vous répondre avec une phrase complète ? Par exemple : « Je m'appelle… ».";
      return { reponse, corrections, ...traductionDemo(reponse) };
    }
    const reaction = ["Très bien !", "D'accord, merci.", "Intéressant !"][tour % 3];
    const relance = conversation.relances[tour] ?? "Merci pour cet échange, vous pouvez terminer la conversation.";
    const reponse = `${reaction} ${relance}`;
    return { reponse, corrections, ...traductionDemo(reponse) };
  },

  /** Correction séparée simulée : même détection d'erreurs, contrat public du relais backend. */
  async corrigerChatbot({ message }: MessageChatbotDto): Promise<CorrectionSepareeChatbotDto> {
    await delay(200);
    return {
      corrections: repererErreurs(message)
        .slice(0, 3)
        .map((correction) => ({ type: "grammaire" as const, ...correction })),
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
    return {
      id_exercice: 901,
      enonce: `Réécrivez « ${erreur} » au passé.`,
      consigne: `Exercice de démonstration ciblé sur ${typeErreur}.`,
      descripteur_id: "cecrl-a1-grammaire-1",
      niveau: "A1",
    };
  },
};
