"use client";

import { useReducer } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { etatInitial, reducteur } from "@/lib/testAdaptatif";
import { testDiagnosticService } from "@/services/test-diagnostic.service";
import type { CodeLangue } from "@/types/langue";
import type { CreneauPresence, ObjectifFormation, ReponseTest } from "@/types/test-diagnostic";
import type { ReponseProgression } from "@/services/test-diagnostic.service";

export function useTestDiagnostic(langueInitiale: CodeLangue) {
  const [etat, dispatch] = useReducer(reducteur, langueInitiale, etatInitial);
  const demarrage = useMutation({
    mutationFn: (variables: { langue: CodeLangue; objectif: ObjectifFormation; creneaux: CreneauPresence[] }) =>
      testDiagnosticService.demarrer(variables.langue, variables.objectif, variables.creneaux),
  });
  const reponse = useMutation({
    mutationFn: ({
      idSession,
      idQuestion,
      reponse,
      valeurChoix,
      progression,
    }: {
      idSession: string;
      idQuestion: string;
      reponse: ReponseTest;
      valeurChoix?: string;
      progression: ReponseProgression;
    }) => testDiagnosticService.repondre(idSession, idQuestion, reponse, valeurChoix, progression),
  });
  const terminaison = useMutation({
    mutationFn: (idSession: string) => testDiagnosticService.terminer(idSession),
  });

  const choisirLangue = (langue: CodeLangue) => {
    demarrage.reset();
    reponse.reset();
    terminaison.reset();
    dispatch({ type: "choisirLangue", langue });
  };

  const demarrer = (personnalisation: { objectif: ObjectifFormation; creneaux: CreneauPresence[] }) => {
    dispatch({ type: "personnaliser", personnalisation });
    demarrage.mutate({ langue: etat.langue, ...personnalisation }, {
      onSuccess: (session) => dispatch({ type: "demarrer", session }),
    });
  };

  const soumettre = (reponseTest: ReponseTest, choix: number | null) => {
    if (!etat.sessionId || !etat.courante || etat.phase !== "question") return;
    if (choix !== null) dispatch({ type: "choisirReponse", choix });
    reponse.mutate(
      {
        idSession: etat.sessionId,
        idQuestion: etat.courante.id,
        reponse: reponseTest,
        valeurChoix: choix === null ? undefined : etat.courante.choix?.[choix],
        progression: {
          questionSuivante: etat.questionsRestantes[0] ?? null,
          numeroQuestion: etat.numeroQuestion,
          totalQuestions: etat.totalQuestions,
        },
      },
      { onSuccess: (retour) => dispatch({ type: "repondre", choix, retour }) },
    );
  };

  const repondre = (choix: number) => soumettre({ type: "choix", choix }, choix);
  const repondreTexte = (texte: string) => {
    dispatch({ type: "choisirTexte", texte });
    soumettre({ type: "texte", texte }, null);
  };
  const repondreAudio = (audio: Blob) => {
    dispatch({ type: "choisirAudio", audio });
    soumettre({ type: "audio", audio }, null);
  };

  const recommencer = () => {
    demarrage.reset();
    reponse.reset();
    terminaison.reset();
    dispatch({ type: "recommencer" });
  };

  const terminer = () => {
    if (etat.phase !== "retour" || !etat.retour) return;
    if (etat.retour.resultat || etat.retour.questionSuivante) {
      dispatch({ type: "suivante" });
      return;
    }
    if (!etat.sessionId) {
      dispatch({ type: "suivante" });
      return;
    }
    terminaison.mutate(etat.sessionId, {
      onSuccess: (resultat) => dispatch({ type: "terminer", resultat }),
    });
  };

  const reessayerTerminaison = () => {
    if (etat.sessionId) terminaison.mutate(etat.sessionId, {
      onSuccess: (resultat) => dispatch({ type: "terminer", resultat }),
    });
  };

  return {
    etat,
    choisirLangue,
    personnaliser: (objectif: ObjectifFormation, creneaux: CreneauPresence[]) =>
      dispatch({ type: "personnaliser", personnalisation: { objectif, creneaux } }),
    retourIntroduction: () => dispatch({ type: "retourIntroduction" }),
    choisirReponse: (choix: number) => {
      reponse.reset();
      dispatch({ type: "choisirReponse", choix });
    },
    choisirTexte: (texte: string) => {
      reponse.reset();
      dispatch({ type: "choisirTexte", texte });
    },
    choisirAudio: (audio: Blob) => {
      reponse.reset();
      dispatch({ type: "choisirAudio", audio });
    },
    demarrer,
    repondre,
    repondreTexte,
    repondreAudio,
    suivante: terminer,
    recommencer,
    demarrageEnCours: demarrage.isPending,
    erreurDemarrage: demarrage.error,
    langueIndisponible: demarrage.error instanceof ApiError && demarrage.error.status === 404,
    reponseEnCours: reponse.isPending,
    erreurReponse: reponse.error,
    terminaisonEnCours: terminaison.isPending,
    erreurTerminaison: terminaison.error,
    reessayerTerminaison,
    reessayerReponse: () => {
      if (!etat.sessionId || !etat.courante) return;
      let reponseTest: ReponseTest;
      if (etat.courante.typeReponse === "choix" && etat.choisie !== null) {
        reponseTest = { type: "choix", choix: etat.choisie };
      } else if (etat.courante.typeReponse === "texte" && etat.texteSaisi.trim()) {
        reponseTest = { type: "texte", texte: etat.texteSaisi };
      } else if (etat.courante.typeReponse === "audio" && etat.audioEnregistre) {
        reponseTest = { type: "audio", audio: etat.audioEnregistre };
      } else {
        return;
      }
      reponse.mutate(
        {
          idSession: etat.sessionId,
          idQuestion: etat.courante.id,
          reponse: reponseTest,
          valeurChoix: etat.choisie === null ? undefined : etat.courante.choix?.[etat.choisie],
          progression: {
            questionSuivante: etat.questionsRestantes[0] ?? null,
            numeroQuestion: etat.numeroQuestion,
            totalQuestions: etat.totalQuestions,
          },
        },
        { onSuccess: (retour) => dispatch({ type: "repondre", choix: etat.choisie, retour }) },
      );
    },
  };
}
