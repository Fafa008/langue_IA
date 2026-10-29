"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/routes";
import { testDiagnosticService, type ReponseProgression } from "@/services/test-diagnostic.service";
import { useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import type { CodeLangue } from "@/types/langue";
import type { EtatTest, PersonnalisationTest, ReponseTest } from "@/types/test-diagnostic";

interface EnvoiReponse {
  idSession: string;
  idQuestion: string;
  reponse: ReponseTest;
  /** Libellé du choix sélectionné : c'est lui que le backend enregistre (`reponse_fournie`). */
  valeurChoix?: string;
  progression: ReponseProgression;
}

/** Réponse en attente d'envoi, reconstruite depuis l'état (utile pour réessayer après une erreur réseau). */
function reponseSaisie(etat: EtatTest): ReponseTest | null {
  const question = etat.courante;
  if (question?.typeReponse === "choix" && etat.choisie !== null) return { type: "choix", choix: etat.choisie };
  if (question?.typeReponse === "texte" && etat.texteSaisi.trim()) return { type: "texte", texte: etat.texteSaisi };
  if (question?.typeReponse === "audio" && etat.audioEnregistre) return { type: "audio", audio: etat.audioEnregistre };
  return null;
}

/**
 * Actions du test de positionnement. L'état vit dans le store unique, les appels API passent par le service,
 * et chaque fin d'étape mène à la page suivante : démarrage → test → résultats.
 */
export function useTestDiagnostic() {
  const router = useRouter();
  const etat = useTestDiagnosticStore((s) => s.etat);
  const dispatch = useTestDiagnosticStore((s) => s.dispatch);

  const demarrage = useMutation({
    mutationFn: ({ langue, personnalisation }: { langue: CodeLangue; personnalisation: PersonnalisationTest }) =>
      testDiagnosticService.demarrer(langue, personnalisation.objectif, personnalisation.creneaux),
  });
  const reponse = useMutation({
    mutationFn: ({ idSession, idQuestion, reponse, valeurChoix, progression }: EnvoiReponse) =>
      testDiagnosticService.repondre(idSession, idQuestion, reponse, valeurChoix, progression),
  });
  const terminaison = useMutation({
    mutationFn: (idSession: string) => testDiagnosticService.terminer(idSession),
  });

  const reinitialiserRequetes = () => {
    demarrage.reset();
    reponse.reset();
    terminaison.reset();
  };

  /* Démarrage */

  const choisirLangue = (langue: CodeLangue) => {
    reinitialiserRequetes();
    dispatch({ type: "choisirLangue", langue });
  };

  const personnaliser = (personnalisation: PersonnalisationTest) =>
    dispatch({ type: "personnaliser", personnalisation });

  const demarrer = () => {
    demarrage.mutate({ langue: etat.langue, personnalisation: etat.personnalisation }, {
      onSuccess: (session) => {
        dispatch({ type: "demarrer", session });
        router.push(ROUTES.apprenant.testDiagnostic.test);
      },
    });
  };

  /* Questions */

  const envoyer = (reponseTest: ReponseTest) => {
    const { sessionId, courante } = etat;
    if (!sessionId || !courante || etat.phase !== "question") return;
    const choix = reponseTest.type === "choix" ? reponseTest.choix : null;
    reponse.mutate(
      {
        idSession: sessionId,
        idQuestion: courante.id,
        reponse: reponseTest,
        valeurChoix: choix === null ? undefined : courante.choix?.[choix],
        progression: {
          questionSuivante: etat.questionsRestantes[0] ?? null,
          numeroQuestion: etat.numeroQuestion,
          totalQuestions: etat.totalQuestions,
        },
      },
      { onSuccess: (retour) => dispatch({ type: "repondre", choix, retour }) },
    );
  };

  const repondre = (choix: number) => {
    dispatch({ type: "choisirReponse", choix });
    envoyer({ type: "choix", choix });
  };
  const repondreTexte = (texte: string) => {
    dispatch({ type: "choisirTexte", texte });
    envoyer({ type: "texte", texte });
  };
  const repondreAudio = (audio: Blob) => {
    dispatch({ type: "choisirAudio", audio });
    envoyer({ type: "audio", audio });
  };
  const reessayerReponse = () => {
    const saisie = reponseSaisie(etat);
    if (saisie) envoyer(saisie);
  };

  /* Fin du test : le résultat vient de la dernière réponse (mode démo) ou du calcul de score du backend. */

  const afficherResultat = () => router.push(ROUTES.apprenant.testDiagnostic.resultats);

  const terminer = () => {
    if (!etat.sessionId) return;
    terminaison.mutate(etat.sessionId, {
      onSuccess: (resultat) => {
        dispatch({ type: "terminer", resultat });
        afficherResultat();
      },
    });
  };

  const suivante = () => {
    if (etat.phase !== "retour" || !etat.retour) return;
    if (etat.retour.questionSuivante) {
      dispatch({ type: "suivante" });
    } else if (etat.retour.resultat) {
      dispatch({ type: "suivante" });
      afficherResultat();
    } else {
      terminer();
    }
  };

  const recommencer = () => {
    reinitialiserRequetes();
    dispatch({ type: "recommencer" });
    router.push(ROUTES.apprenant.testDiagnostic.demarrage);
  };

  return {
    etat,
    choisirLangue,
    personnaliser,
    retourIntroduction: () => dispatch({ type: "retourIntroduction" }),
    demarrer,
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
    repondre,
    repondreTexte,
    repondreAudio,
    reessayerReponse,
    suivante,
    reessayerTerminaison: terminer,
    recommencer,
    demarrageEnCours: demarrage.isPending,
    erreurDemarrage: demarrage.error,
    langueIndisponible: demarrage.error instanceof ApiError && demarrage.error.status === 404,
    reponseEnCours: reponse.isPending,
    erreurReponse: reponse.error,
    terminaisonEnCours: terminaison.isPending,
    erreurTerminaison: terminaison.error,
  };
}
