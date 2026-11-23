"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PROGRESSION_SIMULEE, type ProgressionApprenant } from "@/mocks/progression-apprenant.mock";
import { graduations, pourcentage } from "@/lib/graphique";
import { ROUTES } from "@/lib/routes";

/**
 * US51-FE — Vue de progression. Les indicateurs détaillés restent simulés (aucun endpoint historique côté backend) ;
 * le dernier résultat de positionnement, lui, vient de la session locale et peut être affiché en toute transparence.
 */
export default function ProgressionView({
  progression = PROGRESSION_SIMULEE,
  diagnostic,
}: {
  progression?: ProgressionApprenant | null;
  /** Dernier résultat de test enregistré dans cette session, transmis par la page. */
  diagnostic?: { niveau: string; score: number; total: number } | null;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Espace apprenant</p>
        <h1 className="mt-2">Ma progression</h1>
        <p role="note" data-testid="donnees-simulees" className="mt-3 inline-block rounded-full bg-warning/15 px-3 py-1 text-small font-semibold text-warning-dark">
          Indicateurs simulés — démonstration
        </p>
      </header>

      {diagnostic && (
        <section aria-labelledby="titre-positionnement" data-testid="positionnement-reel" className="card border-primary/30">
          <h2 id="titre-positionnement" className="text-h3 text-primary">Votre dernier positionnement</h2>
          <p className="mt-2 text-content">
            Niveau <strong>{diagnostic.niveau}</strong> · {diagnostic.score}/{diagnostic.total} points
          </p>
          <p className="mt-1 text-small text-content-secondary">
            Résultat de votre test de positionnement réalisé dans cette session.
          </p>
          <Link href={ROUTES.apprenant.testDiagnostic.demarrage} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline">
            Refaire un test <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      )}

      {!progression ? (
        <p className="card text-content-secondary">Votre progression apparaîtra dès votre premier exercice.</p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicateurs de progression">
            <li className="card">
              <p className="text-small text-content-secondary">Progression du parcours</p>
              <p className="mt-1 text-h2 font-bold text-primary" data-testid="kpi-progression">
                {pourcentage(progression.leconAtteinte, progression.leconsTotal)} %
              </p>
              <p className="text-small text-content-secondary">
                Leçon {progression.leconAtteinte} sur {progression.leconsTotal}
              </p>
            </li>
            <li className="card">
              <p className="text-small text-content-secondary">Score moyen</p>
              <p className="mt-1 text-h2 font-bold text-primary" data-testid="kpi-score">{progression.scoreMoyen}/100</p>
            </li>
            <li className="card">
              <p className="text-small text-content-secondary">Dernière leçon</p>
              <p className="mt-1 text-h3 font-bold text-primary" data-testid="kpi-derniere-lecon">
                Leçon {progression.derniereLecon.numero}
              </p>
              <p className="text-small text-content-secondary">{progression.derniereLecon.intitule}</p>
            </li>
            <li className="card">
              <p className="text-small text-content-secondary">Série</p>
              <p className="mt-1 text-h2 font-bold text-primary" data-testid="kpi-serie">
                {progression.serieJours} jour{progression.serieJours > 1 ? "s" : ""}
              </p>
            </li>
          </ul>

          <section aria-labelledby="titre-graphique" className="card">
            <h2 id="titre-graphique" className="text-h3 text-content">Exercices faits cette semaine</h2>
            <GraphiqueExercices valeurs={progression.exercicesParJour} />
          </section>
        </>
      )}
    </div>
  );
}

/** Histogramme simple en éléments HTML : une colonne par jour, hauteur proportionnelle au maximum arrondi. */
function GraphiqueExercices({ valeurs }: { valeurs: { jour: string; nombre: number }[] }) {
  const maximum = Math.max(0, ...valeurs.map((v) => v.nombre));
  const echelle = graduations(maximum);
  const plafond = echelle[echelle.length - 1] || 1;
  return (
    <figure className="mt-4">
      <div role="img" aria-label={valeurs.map((v) => `${v.jour} : ${v.nombre}`).join(", ")} className="flex h-40 items-end gap-2">
        {valeurs.map((v) => (
          <div key={v.jour} className="flex h-full flex-1 flex-col justify-end">
            <div className="rounded-t-btn bg-primary/80" style={{ height: `${pourcentage(v.nombre, plafond)}%` }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex gap-2 text-small text-content-secondary">
        {valeurs.map((v) => (
          <span key={v.jour} className="flex-1 text-center">
            {v.jour}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
