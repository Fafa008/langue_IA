/*
 * Parcours personnalisé de l'apprenant (domaine Pédagogie), créé à partir de son test de positionnement.
 * Tables concernées (backend/app/models/parcours.py) : parcours, parcours_exercice, exercice ;
 * le contenu d'un exercice (`exercice.contenu`, texte) est un JSON décrit par `ContenuExercice`.
 * Seul le regroupement en modules n'a pas encore de table : voir docs/api/contrat-frontend.md.
 */
import type { CadreReference } from "@/types/test-diagnostic";

/** Méthode Assimil : phase passive jusqu'à la leçon 49, active à partir de la leçon 50 (règle du backend). */
export type PhaseParcours = "PASSIVE" | "ACTIVE";

export type StatutParcours = "EN_COURS" | "TERMINE" | "ABANDONNE";

/** Types d'exercice du backend (enum TypeExercice). */
export type TypeExercice = "GRAMMAIRE" | "VOCABULAIRE" | "COMPREHENSION" | "ECOUTE" | "ORAL";

/** Statut d'un exercice du parcours, déduit de son score (parcours_exercice.score_obtenu). */
export type StatutExercice = "A_FAIRE" | "REUSSI" | "A_REVOIR";

/** Avancement d'un module ou d'une leçon, déduit de la leçon atteinte et des exercices. */
export type StatutEtape = "TERMINE" | "EN_COURS" | "A_VENIR";

/** Domaines faibles reconnus par l'agent Recommandation (aucun type d'exercice pour `expression_ecrite`). */
export type DomaineFaiblesse =
  | "grammaire"
  | "vocabulaire"
  | "comprehension_ecrite"
  | "comprehension_orale"
  | "expression_ecrite"
  | "expression_orale";

/** Statut public d'une recommandation : PARTIEL = IA indisponible ou réponse inexploitable, liste vide. */
export type StatutRecommandation = "COMPLET" | "PARTIEL";

/** Action de remédiation proposée par l'IA puis revalidée par le backend. */
export interface RecommandationAction {
  domaine: DomaineFaiblesse;
  typeExercice: TypeExercice;
  action: string;
  justification: string;
  priorite: number;
}

export interface RecommandationParcours {
  statut: StatutRecommandation;
  codeLangue: string;
  referentiel: "CECRL" | "HSK";
  niveauCible: string;
  recommandations: RecommandationAction[];
  resume: string;
  confiance: number;
}

/** Module : regroupement de leçons consécutives, sous un thème (pas encore de table côté backend). */
export interface ModuleParcours {
  numero: number;
  titre: string;
  description: string;
  premiereLecon: number;
  derniereLecon: number;
}

export interface ParcoursPersonnalise {
  idParcours: number;
  statut: StatutParcours;
  /** Date ISO 8601. */
  dateCreation: string;
  langue: { code: string; libelle: string };
  cadre: CadreReference;
  /** Niveaux du cadre, du plus bas au plus haut (A1 … C2, ou bandes HSK). */
  niveauxCadre: string[];
  /** Niveau estimé par le test de positionnement ; null si le backend ne le fournit pas. */
  niveauDepart: string | null;
  niveauVise: string;
  /** Leçon du jour : la leçon la plus avancée atteinte par l'apprenant. */
  leconAtteinte: number;
  phase: PhaseParcours;
  /** En phase active, une leçon sur sept est une révision. */
  estLeconDeRevision: boolean;
  modules: ModuleParcours[];
  /** Dernière recommandation calculée, présente dans GET /parcours/en-cours après une demande explicite. */
  recommandation: RecommandationParcours | null;
}

export interface ExerciceParcours {
  idParcoursExercice: number;
  idExercice: number;
  numeroLecon: number;
  type: TypeExercice;
  /** Difficulté de 1 à 5. */
  difficulte: number;
  /** Intitulé court ; null si l'exercice n'en a pas (le type est alors affiché). */
  intitule: string | null;
  statut: StatutExercice;
  /** Score de 0 à 100 ; null tant que l'exercice n'est pas fait. */
  scoreObtenu: number | null;
}

/**
 * Contenu d'un exercice selon sa forme :
 * - choix : une réponse parmi plusieurs (grammaire, vocabulaire, compréhension) ;
 * - texte : phrase à compléter (« ___ »), corrigée automatiquement ;
 * - redaction : réponse libre de quelques phrases, corrigée par l'IA ;
 * - ecoute : extrait audio (fichier ou texte lu par le navigateur) puis question à choix ;
 * - prononciation : phrase à dire à voix haute, reconnue par la reconnaissance vocale ;
 * - conversation : échange avec le professeur IA (chatbot), à l'écrit ou à la voix.
 */
export type ContenuExercice =
  | { format: "choix"; consigne: string; enonce: string; choix: string[] }
  | { format: "texte"; consigne: string; enonce: string }
  | { format: "redaction"; consigne: string; enonce: string; motsMinimum: number }
  | { format: "ecoute"; consigne: string; question: string; choix: string[]; audioUrl: string | null; texteAudio: string | null }
  | { format: "prononciation"; consigne: string; phrase: string }
  | { format: "conversation"; consigne: string; sujet: string; messageInitial: string; echangesMinimum: number };

export interface ExerciceLecon extends ExerciceParcours {
  contenu: ContenuExercice;
}

export interface LeconParcours {
  numero: number;
  estLeconDeRevision: boolean;
  langue: string;
  exercices: ExerciceLecon[];
}

/** Réponse envoyée pour correction : texte, choix, transcription vocale ou conversation complète. */
export type ReponseExercice =
  | { format: "choix" | "texte" | "redaction" | "ecoute" | "prononciation"; reponse: string }
  | { format: "conversation"; messages: MessageChatbot[] };

/**
 * AUTOMATIQUE : correction déterministe par le backend (QCM, écoute, phrase à compléter, prononciation) ;
 * IA : correction par le professeur IA (rédaction, conversation).
 */
export type ModeCorrection = "AUTOMATIQUE" | "IA";

/** Erreur relevée par l'IA dans une réponse libre : le passage fautif, sa correction et pourquoi. */
export interface ErreurRelevee {
  extrait: string;
  correction: string;
  explication: string;
}

export interface CorrectionExercice {
  statut: StatutExercice;
  scoreObtenu: number;
  mode: ModeCorrection;
  commentaire: string;
  /** Bonne réponse, donnée quand la réponse est fausse (QCM, écoute, phrase à compléter). */
  reponseAttendue: string | null;
  /** Règle ou raison de la bonne réponse. */
  explication: string | null;
  pointsForts: string[];
  erreurs: ErreurRelevee[];
  /** Conseil pour progresser. */
  conseil: string | null;
  /**
   * Contrat v2 (US157) — correction par l'IA seulement : phase et leçon atteinte selon lesquelles le retour a été
   * rédigé (passive : erreurs essentielles ; active : correction détaillée). null pour une correction automatique.
   */
  phase: PhaseParcours | null;
  leconAtteinte: number | null;
  /** Phase active : la réponse de l'apprenant entièrement corrigée, à comparer à la sienne. */
  reformulation: string | null;
}

/** Tour de parole du chatbot ; mêmes rôles que le service IA (ia-service/app/schemas/chatbot.py). */
export interface MessageChatbot {
  role: "apprenant" | "assistant";
  contenu: string;
}
