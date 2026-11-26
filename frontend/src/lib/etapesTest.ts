import type { CompetenceTest, EtapePlan, EtapeTest, FormatExercice, Question } from "@/types/test-diagnostic";

/** Durée totale du test : le compte à rebours part de là au démarrage. */
export const DUREE_TEST_MINUTES = 15;

/** Temps imparti par exercice avant passage automatique (les questions peuvent le surcharger). */
export const DUREE_QUESTION_DEFAUT_SECONDES = 60;

/** Valeurs par défaut quand la question ne précise pas ses propres exigences. */
export const DUREE_ORALE_MINIMALE_SECONDES = 30;
export const MOTS_ECRITS_MINIMUM = 30;

interface DefinitionEtape {
  libelle: string;
  /** Consigne affichée en tête de chaque question de l'étape. */
  consigne: string;
  /** Compétences évaluées par l'étape (champ `competence` des questions). */
  competences: CompetenceTest[];
}

/** Les étapes, dans l'ordre où l'apprenant les passe. */
export const ETAPES: Record<EtapeTest, DefinitionEtape> = {
  qcm: {
    libelle: "Grammaire, lexique et compréhension écrite",
    consigne: "Choisissez la bonne réponse parmi les propositions.",
    competences: ["grammaire", "lecture"],
  },
  comprehension_orale: {
    libelle: "Compréhension orale",
    consigne: "Écoutez l'extrait, puis choisissez ce que vous avez entendu.",
    competences: ["ecoute"],
  },
  expression_orale: {
    libelle: "Expression orale",
    consigne: "Répétez la phrase au micro.",
    competences: ["oral"],
  },
  expression_ecrite: {
    libelle: "Expression écrite",
    consigne: "Rédigez un court texte en réponse au sujet.",
    competences: ["ecrit"],
  },
};

export const ORDRE_ETAPES = Object.keys(ETAPES) as EtapeTest[];

/** Étape à laquelle appartient une question, d'après sa compétence. */
export function etapeDe(competence: CompetenceTest): EtapeTest {
  return ORDRE_ETAPES.find((etape) => ETAPES[etape].competences.includes(competence)) ?? "qcm";
}

const CONSIGNES_FORMAT: Record<FormatExercice, string> = {
  qcm: "Choisissez la bonne réponse parmi les propositions.",
  vrai_faux: "Vrai ou faux ? Choisissez la bonne réponse.",
  texte_a_trous: "Complétez le mot manquant avec les lettres proposées.",
  dictee: "Écoutez la phrase, puis écrivez exactement ce que vous avez entendu.",
  parler: "Dites la phrase suivante au micro, sans lire de notes.",
};

/** Consigne affichée : le format de l'exercice, sinon celle de l'étape pour les questions historiques. */
export function consigneDe(question: Pick<Question, "competence" | "format">): string {
  return question.format ? CONSIGNES_FORMAT[question.format] : ETAPES[etapeDe(question.competence)].consigne;
}

/** Temps disponible sur une question avant passage automatique. */
export function dureeQuestion(question: Pick<Question, "dureeSecondes">): number {
  return question.dureeSecondes && question.dureeSecondes > 0
    ? question.dureeSecondes
    : DUREE_QUESTION_DEFAUT_SECONDES;
}

/** Questions triées dans l'ordre des étapes (l'ordre d'origine est gardé à l'intérieur d'une étape). */
export function trierParEtape<T extends Pick<Question, "competence">>(questions: T[]): T[] {
  const rang = (question: T) => ORDRE_ETAPES.indexOf(etapeDe(question.competence));
  return [...questions].sort((a, b) => rang(a) - rang(b));
}

/** Plan d'un test : nombre de questions de chaque étape présente, dans l'ordre des étapes. */
export function planDepuisQuestions(questions: Pick<Question, "competence">[]): EtapePlan[] {
  return ORDRE_ETAPES
    .map((etape) => ({ etape, nombreQuestions: questions.filter((q) => etapeDe(q.competence) === etape).length }))
    .filter(({ nombreQuestions }) => nombreQuestions > 0);
}

/** Position de l'étape d'une question dans le plan : « Étape 2/4 ». */
export function positionEtape(plan: EtapePlan[], etape: EtapeTest): { numero: number; total: number } {
  return { numero: plan.findIndex((item) => item.etape === etape) + 1, total: plan.length };
}

/** 75 → « 01:15 » */
export function formaterDuree(secondes: number): string {
  const total = Math.max(0, Math.ceil(secondes));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const IDEOGRAMME = /\p{Script=Han}/gu;

/**
 * Nombre de mots d'un texte (la ponctuation isolée ne compte pas).
 * Le chinois ne sépare pas ses mots par des espaces : chaque idéogramme compte pour un mot.
 */
export function compterMots(texte: string): number {
  const ideogrammes = texte.match(IDEOGRAMME)?.length ?? 0;
  const mots = texte.replace(IDEOGRAMME, " ").split(/\s+/).filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
  return ideogrammes + mots;
}
