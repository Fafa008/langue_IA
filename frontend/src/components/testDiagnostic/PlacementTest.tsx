"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { getErrorMessage } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { libelleLangue } from "@/lib/languages";
import { ROUTES } from "@/lib/routes";
import { selectTestEnCours, useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import type { CodeLangue } from "@/types/langue";
import BoutonRetour from "./BoutonRetour";
import ChoixLangueTest from "./ChoixLangueTest";
import PersonalisationForm from "./PersonalisationForm";

/** Page de démarrage : choix de la langue puis personnalisation, jusqu'à la création de la tentative. */
export default function PlacementTest({ langueDemandee }: { langueDemandee?: CodeLangue }) {
  const router = useRouter();
  const test = useTestDiagnostic();
  const { etat } = test;
  const libelle = libelleLangue(etat.langue);
  const enCours = useTestDiagnosticStore(selectTestEnCours);

  // Page suivante chargée d'avance : pas d'attente au clic sur « Commencer le test IA ».
  useEffect(() => router.prefetch(ROUTES.apprenant.testDiagnostic.test), [router]);

  // Arrivée sur la page : un test commencé reprend, un test terminé laisse place à un nouveau,
  // et la langue de l'URL (?langue=de) est présélectionnée.
  useEffect(() => {
    const { etat: actuel, dispatch } = useTestDiagnosticStore.getState();
    if (selectTestEnCours(useTestDiagnosticStore.getState())) {
      router.replace(ROUTES.apprenant.testDiagnostic.test);
      return;
    }
    if (actuel.phase === "resultat") dispatch({ type: "recommencer" });
    if (langueDemandee && langueDemandee !== useTestDiagnosticStore.getState().etat.langue) {
      dispatch({ type: "choisirLangue", langue: langueDemandee });
    }
  }, [langueDemandee, router]);

  if (enCours) return null;

  const erreurs = (
    <>
      {test.langueIndisponible && (
        <Alert className="mt-4">Le test de {libelle.toLowerCase()} n&apos;est pas encore disponible.</Alert>
      )}
      {test.erreurDemarrage && !test.langueIndisponible && (
        <Alert className="mt-4">{getErrorMessage(test.erreurDemarrage)}</Alert>
      )}
    </>
  );

  if (etat.phase === "personnalisation") {
    return (
      <div className="mx-auto max-w-3xl">
        <BoutonRetour onClick={test.retourIntroduction} libelle="Retour au choix de la langue" disabled={test.demarrageEnCours} />
        <p className="eyebrow">Personnalisation de votre parcours</p>
        <h1 className="mt-2">Quelques questions avant de commencer…</h1>

        <section className="card mt-6">
          <PersonalisationForm value={etat.personnalisation} disabled={test.demarrageEnCours} onChange={test.personnaliser} />
        </section>

        {erreurs}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={test.demarrageEnCours || test.langueIndisponible}
            onClick={test.demarrer}
          >
            {test.demarrageEnCours
              ? "Préparation du test…"
              : test.langueIndisponible
                ? "Test indisponible"
                : test.erreurDemarrage
                  ? "Réessayer"
                  : <>Commencer le test IA <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BoutonRetour href={ROUTES.apprenant.dashboard} libelle="Retour à mon espace" />
      <p className="eyebrow">Test de positionnement</p>
      <h1 className="mt-2">Évaluons votre niveau</h1>
      <p className="mb-6 mt-1 text-content-secondary">Choisissez la langue que vous souhaitez évaluer.</p>

      <ChoixLangueTest value={etat.langue} onChange={test.choisirLangue} />

      <ul className="card mt-6 space-y-2">
        <li>Grammaire, compréhension écrite et orale, expression écrite et orale</li>
        <li>La difficulté s&apos;adapte à vos réponses et à votre objectif</li>
      </ul>

      <p role="note" className="mt-4 rounded-btn border border-border bg-background p-3 text-small text-content-secondary">
        {API_MOCK
          ? "Mode démonstration : l’évaluation des réponses écrites et orales est simulée jusqu’à la connexion du service IA."
          : "Vos réponses seront enregistrées et le score calculé à la fin. Le service IA pourra ensuite compléter l’évaluation et adapter le parcours."}
      </p>

      {erreurs}

      <button type="button" className="btn-primary mt-6 w-full" onClick={() => test.personnaliser(etat.personnalisation)}>
        Continuer
      </button>
    </div>
  );
}
