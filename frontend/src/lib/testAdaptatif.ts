import type { ActionTest, EtatTest } from "@/types/test-diagnostic";

export const etatInitial = (langue: string | null): EtatTest => ({
  phase: "intro",
  langue,
  personnalisation: { objectif: "professionnel", creneaux: [] },
  sessionId: null,
  niveaux: [],
  numeroQuestion: 0,
  totalQuestions: 0,
  courante: null,
  questionsRestantes: [],
  choisie: null,
  texteSaisi: "",
  audioEnregistre: null,
  retour: null,
  reponses: [],
  resultat: null,
});

export function reducteur(etat: EtatTest, action: ActionTest): EtatTest {
  switch (action.type) {
    case "choisirLangue":
      return etat.phase === "intro" ? etatInitial(action.langue) : etat;
    case "personnaliser":
      return etat.phase === "intro" || etat.phase === "personnalisation"
        ? { ...etat, phase: "personnalisation", personnalisation: action.personnalisation }
        : etat;
    case "retourIntroduction":
      return etat.phase === "personnalisation" ? { ...etat, phase: "intro" } : etat;
    case "demarrer": {
      const { session } = action;
      return {
        ...etat,
        phase: "question",
        sessionId: session.id,
        langue: session.langue,
        niveaux: session.niveaux,
        numeroQuestion: session.numeroQuestion,
        totalQuestions: session.totalQuestions,
        courante: session.question,
        questionsRestantes: session.questions?.filter((question) => question.id !== session.question.id) ?? [],
        choisie: null,
        texteSaisi: "",
        audioEnregistre: null,
        retour: null,
        reponses: [],
        resultat: null,
      };
    }
    case "choisirReponse":
      if (
        etat.phase !== "question"
        || !etat.courante
        || !Number.isInteger(action.choix)
        || action.choix < 0
        || action.choix >= (etat.courante.choix?.length ?? 0)
      ) return etat;
      return { ...etat, choisie: action.choix };
    case "choisirTexte":
      if (etat.phase !== "question" || etat.courante?.typeReponse !== "texte") return etat;
      return { ...etat, texteSaisi: action.texte };
    case "choisirAudio":
      if (etat.phase !== "question" || etat.courante?.typeReponse !== "audio") return etat;
      return { ...etat, audioEnregistre: action.audio };
    case "repondre": {
      if (etat.phase !== "question" || !etat.courante) return etat;
      return {
        ...etat,
        phase: "retour",
        choisie: action.choix,
        texteSaisi: "",
        audioEnregistre: null,
        numeroQuestion: action.retour.numeroQuestion,
        totalQuestions: action.retour.totalQuestions,
        retour: action.retour,
        reponses: [
          ...etat.reponses,
          {
            idQuestion: etat.courante.id,
            niveau: etat.courante.niveau,
            competence: etat.courante.competence,
            typeReponse: etat.courante.typeReponse,
            ...(action.retour.typeReponse === "choix" ? { correcte: action.retour.correcte } : {}),
          },
        ],
      };
    }
    case "terminer":
      if (etat.phase !== "retour" || etat.retour?.questionSuivante) return etat;
      return {
        ...etat,
        phase: "resultat",
        courante: null,
        choisie: null,
        resultat: action.resultat,
      };
    case "suivante": {
      if (etat.phase !== "retour") return etat;
      // Mode démo : le résultat arrive avec la dernière réponse
      if (etat.retour?.resultat) {
        return { ...etat, phase: "resultat", courante: null, choisie: null, resultat: etat.retour.resultat };
      }
      // Backend : sans question suivante, le résultat est obtenu par l'action « terminer »
      if (!etat.retour?.questionSuivante) return etat;
      return {
        ...etat,
        phase: "question",
        numeroQuestion: etat.numeroQuestion + 1,
        courante: etat.retour.questionSuivante,
        questionsRestantes: etat.retour.typeReponse === "en_attente"
          ? etat.questionsRestantes.slice(1)
          : etat.questionsRestantes,
        choisie: null,
        texteSaisi: "",
        audioEnregistre: null,
        retour: null,
      };
    }
    case "recommencer":
      return etatInitial(etat.langue);
  }
}