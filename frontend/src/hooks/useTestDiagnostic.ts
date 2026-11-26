"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/routes";
import { testDiagnosticService, type ReponseProgression } from "@/services/test-diagnostic.service";
import { useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import type { EtatTest, PersonnalisationTest, ReponseTest, TestInterrompu } from "@/types/test-diagnostic";

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

/** Langues proposées sur l'écran d'accueil du test (chargées une fois par session de navigation). */
export function useLanguesDiagnostic() {
  return useQuery({
    queryKey: queryKeys.languesDiagnostic,
    queryFn: () => testDiagnosticService.langues(),
    staleTime: Infinity,
  });
}

/**
 * Test commencé puis interrompu (onglet fermé, autre appareil), retrouvé sur le serveur.
 * `actif` : seulement quand aucun test n'est déjà en cours dans cet onglet.
 */
export function useTestInterrompu(actif: boolean) {
  return useQuery({
    queryKey: queryKeys.testInterrompu,
    queryFn: () => testDiagnosticService.testEnCours(),
    enabled: actif,
    staleTime: 0,
    retry: false,
  });
}

/**
 * Actions du test de positionnement. L'état vit dans le store unique, les appels API passent par le service,
 * et chaque fin d'étape mène à la page suivante : démarrage → test → résultats.
 */
export function useTestDiagnostic() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const etat = useTestDiagnosticStore((s) => s.etat);
  const dispatch = useTestDiagnosticStore((s) => s.dispatch);

  const demarrage = useMutation({
    mutationFn: ({ langue, personnalisation }: { langue: string; personnalisation: PersonnalisationTest }) =>
      testDiagnosticService.demarrer(langue, personnalisation.objectif, personnalisation.creneaux),
  });
  const reponse = useMutation({
    mutationFn: ({ idSession, idQuestion, reponse, valeurChoix, progression }: EnvoiReponse) =>
      testDiagnosticService.repondre(idSession, idQuestion, reponse, valeurChoix, progression),
  });
  const terminaison = useMutation({
    mutationFn: (idSession: string) => testDiagnosticService.terminer(idSession),
  });
  const abandon = useMutation({
    mutationFn: (idSession: string) => testDiagnosticService.abandonner(idSession),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.testInterrompu }),
  });

  /** Le test interrompu n'est plus d'actualité dès qu'un test démarre ou reprend. */
  const oublierTestInterrompu = () => queryClient.removeQueries({ queryKey: queryKeys.testInterrompu });

  const reinitialiserRequetes = () => {
    demarrage.reset();
    reponse.reset();
    terminaison.reset();
    abandon.reset();
  };

  /* Démarrage */

  const choisirLangue = (langue: string | null) => {
    reinitialiserRequetes();
    dispatch({ type: "choisirLangue", langue });
  };

  const personnaliser = (personnalisation: PersonnalisationTest) =>
    dispatch({ type: "personnaliser", personnalisation });

  const demarrer = () => {
    // Sans langue choisie, le test ne peut pas démarrer (le bouton est désactivé à l'écran)
    if (!etat.langue) return;
    demarrage.mutate({ langue: etat.langue, personnalisation: etat.personnalisation }, {
      onSuccess: (session) => {
        oublierTestInterrompu();
        dispatch({ type: "demarrer", session, debut: Date.now() });
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

  /** Temps imparti écoulé : l'exercice est compté faux, on passe automatiquement au suivant. */
  const expirerQuestion = () => {
    const { sessionId, courante, questionsRestantes } = etat;
    if (!sessionId || !courante || etat.phase !== "question" || reponse.isPending) return;
    reponse.mutate(
      {
        idSession: sessionId,
        idQuestion: courante.id,
        reponse: { type: "sans_reponse" },
        progression: {
          questionSuivante: questionsRestantes[0] ?? null,
          numeroQuestion: etat.numeroQuestion,
          totalQuestions: etat.totalQuestions,
        },
      },
      {
        onSuccess: (retour) => {
          dispatch({ type: "repondre", choix: null, retour });
          if (retour.questionSuivante || retour.resultat) dispatch({ type: "suivante" });
          else terminer();
        },
      },
    );
  };

  /*
   * Fin du test : le backend calcule le score, lance l'analyse IA best-effort et répond directement avec le résultat.
   */

  const afficherResultat = () => router.push(ROUTES.apprenant.testDiagnostic.resultats);

  const terminer = () => {
    if (!etat.sessionId) return;
    terminaison.mutate(etat.sessionId, {
      onSuccess: (issue) => {
        dispatch({ type: "terminer", resultat: issue.resultat });
        afficherResultat();
      },
    });
  };

  /**
   * Démo uniquement : l'apprenant abandonne l'exercice (0 point, aucune correction dévoilée) et on enchaîne
   * immédiatement. Le backend ne gère pas cette variante : le bouton n'est exposé qu'en mode API simulée.
   */
  const passer = () => {
    const { sessionId, courante, questionsRestantes } = etat;
    if (!sessionId || !courante || etat.phase !== "question" || reponse.isPending) return;
    reponse.reset();
    reponse.mutate(
      {
        idSession: sessionId,
        idQuestion: courante.id,
        reponse: { type: "automatique" },
        progression: {
          questionSuivante: questionsRestantes[0] ?? null,
          numeroQuestion: etat.numeroQuestion,
          totalQuestions: etat.totalQuestions,
        },
      },
      {
        onSuccess: (retour) => {
          dispatch({ type: "repondre", choix: null, retour });
          if (retour.resultat) {
            dispatch({ type: "suivante" });
            afficherResultat();
          } else if (retour.questionSuivante) {
            dispatch({ type: "suivante" });
          } else {
            terminer();
          }
        },
      },
    );
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

  /* Reprise d'un test interrompu, ou abandon pour en commencer un nouveau */

  const reprendre = (test: TestInterrompu) => {
    reinitialiserRequetes();
    if (test.session) {
      oublierTestInterrompu();
      dispatch({ type: "reprendre", test });
      router.push(ROUTES.apprenant.testDiagnostic.test);
      return;
    }
    // Toutes les questions avaient une réponse : il ne reste qu'à calculer le résultat
    terminaison.mutate(test.idSession, {
      onSuccess: (issue) => {
        oublierTestInterrompu();
        dispatch({ type: "reprendre", test, resultat: issue.resultat });
        afficherResultat();
      },
    });
  };

  /**
   * Abandonne la tentative enregistrée localement et tente d'appeler le backend sans bloquer l'UI.
   * La route d'abandon n'existe pas encore côté backend : cet appel échoue en 404 hors mode mock.
   */
  const abandonnerTestInterrompu = (test: TestInterrompu) => {
    reinitialiserRequetes();
    abandon.mutate(test.idSession);
  };

  const recommencer = () => {
    // Test quitté en cours de route : on tente l'abandon serveur sans bloquer l'UI (404 tant que la route manque)
    const aAbandonner = etat.sessionId && (etat.phase === "question" || etat.phase === "retour") ? etat.sessionId : null;
    reinitialiserRequetes();
    if (aAbandonner) abandon.mutate(aAbandonner);
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
    choisirAudio: (audio: Blob | null) => {
      reponse.reset();
      dispatch({ type: "choisirAudio", audio });
    },
    repondre,
    repondreTexte,
    repondreAudio,
    reessayerReponse,
    expirerQuestion,
    passer,
    suivante,
    /** Termine le test maintenant (temps écoulé, ou nouvel essai après une erreur de calcul). */
    terminer,
    recommencer,
    reprendre,
    abandonnerTestInterrompu,
    repriseEnCours: terminaison.isPending && etat.phase === "intro",
    abandonEnCours: abandon.isPending,
    erreurAbandon: abandon.error,
    demarrageEnCours: demarrage.isPending,
    erreurDemarrage: demarrage.error,
    langueIndisponible: demarrage.error instanceof ApiError && demarrage.error.status === 404,
    reponseEnCours: reponse.isPending,
    erreurReponse: reponse.error,
    terminaisonEnCours: terminaison.isPending,
    erreurTerminaison: terminaison.error,
  };
}
