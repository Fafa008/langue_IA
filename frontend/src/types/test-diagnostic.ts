export type ObjectifFormation = "professionnel" | "personnel" | "scolaire";
export type CreneauPresence = "matin" | "apres_midi" | "soiree";
export type CompetenceTest = "grammaire" | "lecture" | "ecoute" | "ecrit" | "oral";
export const COMPETENCES_TEST = ["grammaire", "lecture", "ecoute", "ecrit", "oral"] as const;

/**
 * Les quatre étapes du test, dans l'ordre où elles sont passées :
 * QCM (grammaire, lexique, compréhension écrite), compréhension orale, expression orale, expression écrite.
 */
export type EtapeTest = "qcm" | "comprehension_orale" | "expression_orale" | "expression_ecrite";

/** Nombre de questions prévues pour une étape du test. */
export interface EtapePlan {
  etape: EtapeTest;
  nombreQuestions: number;
}

/** Données publiques d'une question ; la bonne réponse n'est envoyée qu'après validation. */
export interface Question {
  id: string;
  niveau: string;
  competence: CompetenceTest;
  typeReponse: "choix" | "texte" | "audio";
  enonce: string;
  choix?: string[];
  support?: string;
  audioUrl?: string;
  audioTexte?: string;
  /** Expression orale : durée de parole minimale, en secondes. */
  dureeMinimaleSecondes?: number;
  /** Expression écrite : nombre de mots minimal. */
  motsMinimum?: number;
}

/** Référentiel des niveaux : CECRL (A1 à C2) ou HSK pour le chinois (HSK 1 à 6). */
export type CadreReference = "CECRL" | "HSK";

/** Langue proposée sur l'écran d'accueil du test (GET /diagnostic/langues). */
export interface LangueDiagnostic {
  /** Code de la langue en base (« en »), envoyé à la création de la tentative. */
  code: string;
  libelle: string;
  cadre: CadreReference;
  /** Niveaux ouverts pour la langue, du plus bas au plus haut. */
  niveaux: string[];
  /** Questions posées pendant le test (0 si la langue n'en a pas encore). */
  nombreQuestions: number;
  /** Faux tant qu'aucune question n'est disponible : la langue est affichée « Bientôt disponible ». */
  disponible: boolean;
}

export interface PersonnalisationTest {
  objectif: ObjectifFormation;
  creneaux: CreneauPresence[];
}

export type ReponseTest =
  | { type: "choix"; choix: number }
  | { type: "texte"; texte: string }
  | { type: "audio"; audio: Blob };

export interface SessionTest {
  id: string;
  langue: string;
  niveaux: string[];
  numeroQuestion: number;
  totalQuestions: number;
  /** Étapes du test et nombre de questions de chacune, dans l'ordre. */
  plan: EtapePlan[];
  question: Question;
  questions?: Question[];
}

interface RetourReponseBase {
  numeroQuestion: number;
  totalQuestions: number;
}

export type RetourReponse = RetourReponseBase & (
  | {
      typeReponse: "en_attente";
      questionSuivante: Question | null;
      resultat: null;
    }
  | {
      typeReponse: "choix";
      correcte: boolean;
      bonneReponse: number;
      evaluation?: never;
      questionSuivante: Question | null;
      resultat: ResultatTest | null;
    }
  | {
      typeReponse: "texte" | "audio";
      evaluation: string;
      scorePrononciation?: number;
      questionSuivante: Question | null;
      resultat: ResultatTest | null;
    }
);

/** Domaine d'un point faible repéré par l'analyse (le vocabulaire est distingué de la grammaire). */
export type DomaineFaiblesse =
  | "grammaire"
  | "vocabulaire"
  | "comprehension_ecrite"
  | "comprehension_orale"
  | "expression_ecrite"
  | "expression_orale";

export interface PointFaible {
  domaine: DomaineFaiblesse;
  /** Explication rédigée par l'analyse (LLM), si elle est fournie. */
  detail?: string;
}

/**
 * Phase de la méthode Assimil : imprégnation (phase passive : écouter, lire, répéter)
 * puis activation (phase active : reformuler, produire).
 */
export type PhaseAssimil = "impregnation" | "activation";

/** Descripteur du référentiel retrouvé par le RAG et cité pour justifier le niveau. */
export interface SourceReferentiel {
  id: string;
  referentiel: CadreReference;
  niveau: string;
  competence?: string;
  titre: string;
  extrait: string;
  /** Lien vers le document source (http ou https uniquement). */
  url?: string;
}

/** Justification du niveau : synthèse rédigée par le LLM et descripteurs du référentiel sur lesquels elle s'appuie. */
export interface Justification {
  resume: string;
  sources: SourceReferentiel[];
}

/**
 * Résultat du test. Niveau et score sont toujours présents ; le reste dépend de l'analyse
 * et peut manquer (analyse partielle, backend qui ne le fournit pas encore).
 */
export interface ResultatTest {
  niveau: string;
  score: number;
  total: number;
  cadre?: CadreReference;
  competences: CompetenceResultat[];
  lacunes: CompetenceTest[];
  pointsFaibles?: PointFaible[];
  phaseAssimil?: PhaseAssimil;
  justification?: Justification;
}

/**
 * Issue de la fin du test : le résultat, ou « en attente » tant que le service d'analyse (LLM)
 * n'a pas fini d'évaluer les réponses écrites et orales.
 */
export type IssueTerminaison =
  | { statut: "termine"; resultat: ResultatTest }
  | { statut: "en_attente" };

export interface CompetenceResultat {
  competence: CompetenceTest;
  score: number;
  total: number;
}

/**
 * Tentative commencée puis interrompue (onglet fermé, autre appareil), retrouvée sur le serveur
 * avec les réponses déjà enregistrées.
 */
export interface TestInterrompu {
  idSession: string;
  langue: string;
  /** Début de la tentative (horodatage en ms) : le compte à rebours des 15 minutes reprend où il en était. */
  debut: number;
  totalQuestions: number;
  /** Réponses déjà enregistrées, dans l'ordre du test. */
  reponses: ReponseEnregistree[];
  /** Suite du test à partir de la première question sans réponse ; null si toutes ont déjà une réponse. */
  session: SessionTest | null;
}

export type PhaseTest = "intro" | "personnalisation" | "question" | "retour" | "resultat";

/** Réponse déjà validée par le serveur : sert au suivi de la progression et au récapitulatif. */
export interface ReponseEnregistree {
  idQuestion: string;
  niveau: string;
  competence: CompetenceTest;
  typeReponse: Question["typeReponse"];
  /** Connue pour les questions à choix ; absente pour les réponses libres évaluées par l'IA. */
  correcte?: boolean;
}

export interface EtatTest {
  phase: PhaseTest;
  /** Langue choisie sur l'écran d'accueil ; null tant que l'apprenant n'en a pas choisi. */
  langue: string | null;
  personnalisation: PersonnalisationTest;
  sessionId: string | null;
  niveaux: string[];
  numeroQuestion: number;
  totalQuestions: number;
  plan: EtapePlan[];
  /** Début du test (horodatage en ms) : sert au compte à rebours des 15 minutes. */
  debut: number | null;
  courante: Question | null;
  questionsRestantes: Question[];
  choisie: number | null;
  texteSaisi: string;
  audioEnregistre: Blob | null;
  retour: RetourReponse | null;
  /** Réponses validées, dans l'ordre. */
  reponses: ReponseEnregistree[];
  resultat: ResultatTest | null;
}

export type ActionTest =
  | { type: "choisirLangue"; langue: string }
  | { type: "personnaliser"; personnalisation: PersonnalisationTest }
  | { type: "retourIntroduction" }
  | { type: "demarrer"; session: SessionTest; debut: number }
  | { type: "choisirReponse"; choix: number }
  | { type: "choisirTexte"; texte: string }
  /** null : enregistrement effacé (« Recommencer »). */
  | { type: "choisirAudio"; audio: Blob | null }
  | { type: "repondre"; choix: number | null; retour: RetourReponse }
  | { type: "terminer"; resultat: ResultatTest }
  /** Reprise d'un test interrompu ; avec un résultat quand toutes les questions avaient déjà une réponse. */
  | { type: "reprendre"; test: TestInterrompu; resultat?: ResultatTest }
  | { type: "suivante" }
  | { type: "recommencer" };
