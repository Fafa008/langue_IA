/*
 * Contrat du parcours personnalisé (champs en snake_case renvoyés par le backend)
 * et conversion vers les types du frontend. Voir docs/api/contrat-frontend.md, section « Parcours personnalisé ».
 */
import type { CadreReference } from "@/types/test-diagnostic";
import type {
  ContenuExercice,
  CorrectionExercice,
  ExerciceLecon,
  ExerciceParcours,
  LeconParcours,
  ParcoursPersonnalise,
  PhaseParcours,
  StatutExercice,
  StatutParcours,
  TypeExercice,
} from "@/types/parcours-personnalise";

export interface ModuleParcoursDto {
  numero: number;
  titre: string;
  description: string;
  premiere_lecon: number;
  derniere_lecon: number;
}

/** GET /parcours/en-cours (404 si l'apprenant n'a pas encore de parcours). */
export interface ParcoursPersonnaliseDto {
  id_parcours: number;
  statut: string;
  date_creation: string;
  code_langue: string;
  libelle_langue: string;
  cadre: CadreReference;
  niveaux_cadre: string[];
  niveau_depart?: string | null;
  niveau_vise: string;
  lecon_atteinte: number;
  phase: string;
  est_lecon_de_revision: boolean;
  modules: ModuleParcoursDto[];
}

/** Élément de GET /parcours/{id_parcours}/exercices (une ligne de parcours_exercice et son exercice). */
export interface ExerciceParcoursDto {
  id_parcours_exercice: number;
  id_exercice: number;
  numero_lecon: number;
  type: string;
  difficulte: number;
  intitule?: string | null;
  statut: string;
  score_obtenu: number | null;
}

/** Contenu JSON stocké dans exercice.contenu. */
export interface ContenuExerciceDto {
  format: string;
  consigne: string;
  enonce?: string;
  choix?: string[];
  question?: string;
  audio_url?: string | null;
  texte_audio?: string | null;
  phrase?: string;
  sujet?: string;
  message_initial?: string;
  echanges_minimum?: number;
}

/** GET /parcours/{id_parcours}/lecons/{numero_lecon} (403 si la leçon n'est pas encore atteinte). */
export interface LeconParcoursDto {
  numero_lecon: number;
  est_lecon_de_revision: boolean;
  code_langue: string;
  exercices: (ExerciceParcoursDto & { contenu: string })[];
}

/** POST /parcours/{id_parcours}/exercices/{id_parcours_exercice}/reponse */
export interface CorrectionExerciceDto {
  statut: string;
  score_obtenu: number;
  commentaire: string;
  reponse_attendue?: string | null;
}

/** POST /chatbot/message (relais backend du service IA, tâche B-10) : mêmes champs que ia-service. */
export interface MessageChatbotDto {
  message: string;
  historique: { role: "apprenant" | "assistant"; contenu: string }[];
}
export interface ReponseChatbotDto {
  reponse: string;
}

const STATUTS_PARCOURS: StatutParcours[] = ["EN_COURS", "TERMINE", "ABANDONNE"];
const PHASES: PhaseParcours[] = ["PASSIVE", "ACTIVE"];
const TYPES: TypeExercice[] = ["GRAMMAIRE", "VOCABULAIRE", "COMPREHENSION", "ECOUTE", "ORAL"];
const STATUTS_EXERCICE: StatutExercice[] = ["A_FAIRE", "REUSSI", "A_REVOIR"];

/** Valeur d'énumération reconnue (sans tenir compte de la casse) ; une valeur inconnue est une erreur de contrat. */
function valeurConnue<T extends string>(valeurs: readonly T[], valeur: string, quoi: string): T {
  const trouvee = valeurs.find((v) => v === valeur.toUpperCase());
  if (!trouvee) throw new Error(`${quoi} non reconnu : ${valeur}`);
  return trouvee;
}

function requis<T>(valeur: T | undefined, champ: string): T {
  if (valeur === undefined || valeur === null || valeur === "") throw new Error(`Contenu d'exercice incomplet : ${champ}`);
  return valeur;
}

export function toParcoursPersonnalise(dto: ParcoursPersonnaliseDto): ParcoursPersonnalise {
  return {
    idParcours: dto.id_parcours,
    statut: valeurConnue(STATUTS_PARCOURS, dto.statut, "Statut de parcours"),
    dateCreation: dto.date_creation,
    langue: { code: dto.code_langue, libelle: dto.libelle_langue },
    cadre: dto.cadre,
    niveauxCadre: dto.niveaux_cadre,
    niveauDepart: dto.niveau_depart ?? null,
    niveauVise: dto.niveau_vise,
    leconAtteinte: dto.lecon_atteinte,
    phase: valeurConnue(PHASES, dto.phase, "Phase de parcours"),
    estLeconDeRevision: dto.est_lecon_de_revision,
    modules: [...dto.modules]
      .sort((a, b) => a.numero - b.numero)
      .map((m) => ({
        numero: m.numero,
        titre: m.titre,
        description: m.description,
        premiereLecon: m.premiere_lecon,
        derniereLecon: m.derniere_lecon,
      })),
  };
}

export function toExerciceParcours(dto: ExerciceParcoursDto): ExerciceParcours {
  return {
    idParcoursExercice: dto.id_parcours_exercice,
    idExercice: dto.id_exercice,
    numeroLecon: dto.numero_lecon,
    type: valeurConnue(TYPES, dto.type, "Type d'exercice"),
    difficulte: dto.difficulte,
    intitule: dto.intitule?.trim() || null,
    statut: valeurConnue(STATUTS_EXERCICE, dto.statut, "Statut d'exercice"),
    scoreObtenu: dto.score_obtenu,
  };
}

/** Lit le JSON de exercice.contenu ; un format inconnu ou un champ manquant est une erreur de contrat. */
export function toContenuExercice(json: string): ContenuExercice {
  const dto = JSON.parse(json) as ContenuExerciceDto;
  const consigne = requis(dto.consigne, "consigne");
  switch (dto.format) {
    case "choix":
      return { format: "choix", consigne, enonce: requis(dto.enonce, "enonce"), choix: requis(dto.choix, "choix") };
    case "texte":
      return { format: "texte", consigne, enonce: requis(dto.enonce, "enonce") };
    case "ecoute":
      if (!dto.audio_url && !dto.texte_audio) throw new Error("Contenu d'exercice incomplet : audio_url ou texte_audio");
      return {
        format: "ecoute",
        consigne,
        question: requis(dto.question, "question"),
        choix: requis(dto.choix, "choix"),
        audioUrl: dto.audio_url ?? null,
        texteAudio: dto.texte_audio ?? null,
      };
    case "prononciation":
      return { format: "prononciation", consigne, phrase: requis(dto.phrase, "phrase") };
    case "conversation":
      return {
        format: "conversation",
        consigne,
        sujet: requis(dto.sujet, "sujet"),
        messageInitial: requis(dto.message_initial, "message_initial"),
        echangesMinimum: dto.echanges_minimum ?? 3,
      };
    default:
      throw new Error(`Format d'exercice non reconnu : ${dto.format}`);
  }
}

export function toLeconParcours(dto: LeconParcoursDto): LeconParcours {
  return {
    numero: dto.numero_lecon,
    estLeconDeRevision: dto.est_lecon_de_revision,
    langue: dto.code_langue,
    exercices: dto.exercices
      .map((e): ExerciceLecon => ({ ...toExerciceParcours(e), contenu: toContenuExercice(e.contenu) }))
      .sort((a, b) => a.idParcoursExercice - b.idParcoursExercice),
  };
}

export function toCorrectionExercice(dto: CorrectionExerciceDto): CorrectionExercice {
  return {
    statut: valeurConnue(STATUTS_EXERCICE, dto.statut, "Statut d'exercice"),
    scoreObtenu: dto.score_obtenu,
    commentaire: dto.commentaire,
    reponseAttendue: dto.reponse_attendue ?? null,
  };
}
