"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { libelleLangue as libelleDe } from "@/lib/languages";
import { ECHELLES } from "@/lib/referentiels";
import { informationsManquantes, pointsFaiblesDe, type InformationManquante } from "@/lib/resultatDiagnostic";
import { ROUTES } from "@/lib/routes";
import BoutonRetour from "./BoutonRetour";
import CarteNiveau from "./resultat/CarteNiveau";
import CarteScore from "./resultat/CarteScore";
import DetailCompetences from "./resultat/DetailCompetences";
import EchelleNiveaux from "./resultat/EchelleNiveaux";
import JustificationNiveau from "./resultat/JustificationNiveau";
import PointsFaibles from "./resultat/PointsFaibles";

const LIBELLES_MANQUANTS: Record<InformationManquante, string> = {
  competences: "le détail par compétence",
  points_faibles: "les points faibles",
  phase: "la phase de la méthode Assimil",
  justification: "la justification du niveau",
};

/**
 * Page des résultats du dernier test terminé (lu dans le store) : niveau, phase Assimil, points faibles
 * et justification appuyée sur le référentiel. Les parties que l'analyse n'a pas fournies sont signalées.
 */
export default function TestResult() {
  const router = useRouter();
  const test = useTestDiagnostic();
  const { etat } = test;
  const resultat = etat.phase === "resultat" ? etat.resultat : null;

  // Sans test terminé (accès direct à l'URL), retour au démarrage.
  useEffect(() => {
    if (!resultat) router.replace(ROUTES.apprenant.testDiagnostic.demarrage);
  }, [resultat, router]);

  if (!resultat) return null;

  const libelleLangue = libelleDe(etat.langue ?? "");
  const referentiel = resultat.cadre ?? (resultat.niveau.toUpperCase().startsWith("HSK") ? "HSK" : "CECRL");
  // La tentative ne connaît que son niveau de départ : l'échelle complète du référentiel est affichée.
  const niveaux: readonly string[] = etat.niveaux.length > 1 ? etat.niveaux : ECHELLES[referentiel];
  const manquantes = informationsManquantes(resultat);

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="test-result">
      <BoutonRetour href={ROUTES.apprenant.dashboard} libelle="Retour à mon espace" />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Test terminé</p>
          <h1 className="mt-2">Résultat de votre diagnostic</h1>
        </div>
        <span className="self-start rounded-btn bg-primary px-4 py-2 text-small font-semibold text-white sm:self-auto">
          {libelleLangue} · {referentiel}
        </span>
      </header>

      {manquantes.length > 0 && (
        <p role="status" data-testid="resultat-partiel" className="flex items-start gap-3 rounded-card border border-primary/20 bg-primary/5 p-4 text-content">
          <Info size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Résultat partiel.</span> Votre niveau est établi. Encore à venir dès que
            l&apos;analyse sera complète : {manquantes.map((m) => LIBELLES_MANQUANTS[m]).join(", ")}.
          </span>
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <CarteScore resultat={resultat} />
        <CarteNiveau
          niveau={resultat.niveau}
          referentiel={referentiel}
          libelleLangue={libelleLangue}
          phase={resultat.phaseAssimil}
        />
      </div>

      <EchelleNiveaux niveaux={niveaux} niveau={resultat.niveau} />

      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3 [&>section]:h-full">
          <DetailCompetences competences={resultat.competences} />
        </div>
        <div className="md:col-span-2 [&>section]:h-full">
          <PointsFaibles points={pointsFaiblesDe(resultat)}>
            <Link href={ROUTES.apprenant.dashboard} className="btn-primary w-full">
              Commencer mon parcours
            </Link>
            <button type="button" className="btn-secondary w-full" onClick={test.recommencer}>
              Refaire le test
            </button>
          </PointsFaibles>
        </div>
      </div>

      <JustificationNiveau justification={resultat.justification} />
    </div>
  );
}
