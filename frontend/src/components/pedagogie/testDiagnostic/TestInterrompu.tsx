"use client";

import { useState } from "react";
import { ArrowRight, History } from "lucide-react";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DUREE_TEST_MINUTES } from "@/lib/etapesTest";
import { libelleLangue } from "@/lib/languages";
import type { TestInterrompu as TestInterrompuType } from "@/types/test-diagnostic";

interface TestInterrompuProps {
  test: TestInterrompuType;
  onReprendre: () => void;
  onAbandonner: () => void;
  repriseEnCours?: boolean;
  abandonEnCours?: boolean;
  /** Message déjà rédigé pour l'apprenant (aucun détail technique). */
  erreur?: string | null;
}

const dateDebut = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** « d'anglais », « de français ». */
const deLangue = (code: string) => {
  const libelle = libelleLangue(code).toLowerCase();
  return /^[aeiouyhéè]/.test(libelle) ? `d'${libelle}` : `de ${libelle}`;
};

/** Minutes restantes sur les 15 minutes du test, arrondies au-dessus ; 0 si le temps est écoulé. */
export function minutesRestantes(debut: number, maintenant: number): number {
  const restantMs = debut + DUREE_TEST_MINUTES * 60_000 - maintenant;
  return restantMs > 0 ? Math.ceil(restantMs / 60_000) : 0;
}

/** Test commencé puis interrompu : l'apprenant le reprend là où il en était, ou l'abandonne pour en commencer un nouveau. */
export default function TestInterrompu({
  test,
  onReprendre,
  onAbandonner,
  repriseEnCours = false,
  abandonEnCours = false,
  erreur,
}: TestInterrompuProps) {
  const [confirmerAbandon, setConfirmerAbandon] = useState(false);
  const minutes = minutesRestantes(test.debut, Date.now());
  const repondues = test.reponses.length;
  const occupe = repriseEnCours || abandonEnCours;

  return (
    <section className="card mt-6 border-l-4 border-warning" data-testid="test-interrompu" aria-labelledby="test-interrompu-titre">
      <h2 id="test-interrompu-titre" className="flex items-center gap-2 text-h3 text-content">
        <History size={22} aria-hidden className="text-warning" />
        Test interrompu
      </h2>
      <p className="mt-2 text-content">
        Votre test {deLangue(test.langue)} commencé le {dateDebut.format(test.debut)} n&apos;est pas terminé.
      </p>
      <ul className="mt-3 space-y-1 text-content" data-testid="test-interrompu-detail">
        <li>
          <span className="font-semibold">{repondues}</span> {repondues > 1 ? "réponses enregistrées" : "réponse enregistrée"} sur{" "}
          {test.totalQuestions} : elles sont conservées.
        </li>
        <li>
          {minutes > 0
            ? `Il vous reste environ ${minutes} min pour terminer.`
            : "Le temps est écoulé : votre résultat sera calculé avec les réponses enregistrées."}
        </li>
      </ul>

      {erreur && <Alert className="mt-4">{erreur}</Alert>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" disabled={occupe} onClick={() => setConfirmerAbandon(true)}>
          Commencer un nouveau test
        </button>
        <button type="button" className="btn-primary" disabled={occupe} onClick={onReprendre}>
          {repriseEnCours ? "Calcul de votre résultat…" : <>Reprendre le test <ArrowRight size={18} aria-hidden="true" /></>}
        </button>
      </div>

      {confirmerAbandon && (
        <ConfirmDialog
          title="Commencer un nouveau test ?"
          description="Le test interrompu sera abandonné : ses réponses ne seront pas prises en compte."
          confirmLabel="Abandonner et recommencer"
          pending={abandonEnCours}
          onClose={() => setConfirmerAbandon(false)}
          onConfirm={() => {
            setConfirmerAbandon(false);
            onAbandonner();
          }}
        />
      )}
    </section>
  );
}
