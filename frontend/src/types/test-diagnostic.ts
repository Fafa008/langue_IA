import type { CodeLangue } from "@/types/langue";

export type ObjectifFormation = "professionnel" | "personnel" | "scolaire";
export type CreneauPresence = "matin" | "apres_midi" | "soiree";
export type CompetenceTest = "grammaire" | "lecture" | "ecoute" | "ecrit" | "oral";
export const COMPETENCES_TEST = ["grammaire", "lecture", "ecoute", "ecrit", "oral"] as const;

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
  langue: CodeLangue;
  niveaux: string[];
  numeroQuestion: number;
  totalQuestions: number;
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

export interface ResultatTest {
  niveau: string;
  score: number;
  total: number;
  competences: CompetenceResultat[];
  lacunes: CompetenceTest[];
}

export interface CompetenceResultat {
  competence: CompetenceTest;
  score: number;
  total: number;
}

export type PhaseTest = "intro" | "personnalisation" | "question" | "retour" | "resultat" | "evaluationEnAttente";

export interface EtatTest {
  phase: PhaseTest;
  langue: CodeLangue;
  personnalisation: PersonnalisationTest;
  sessionId: string | null;
  niveaux: string[];
  numeroQuestion: number;
  totalQuestions: number;
  courante: Question | null;
  questionsRestantes: Question[];
  choisie: number | null;
  texteSaisi: string;
  audioEnregistre: Blob | null;
  retour: RetourReponse | null;
  resultat: ResultatTest | null;
}

export type ActionTest =
  | { type: "choisirLangue"; langue: CodeLangue }
  | { type: "personnaliser"; personnalisation: PersonnalisationTest }
  | { type: "retourIntroduction" }
  | { type: "demarrer"; session: SessionTest }
  | { type: "choisirReponse"; choix: number }
  | { type: "choisirTexte"; texte: string }
  | { type: "choisirAudio"; audio: Blob }
  | { type: "repondre"; choix: number | null; retour: RetourReponse }
  | { type: "suivante" }
  | { type: "recommencer" };
