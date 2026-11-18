"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  compterParStatut,
  exercicesParLecon,
  STATUT_EXERCICE_LABELS,
  type FiltreStatut,
} from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import type { ExerciceParcours } from "@/types/parcours-personnalise";
import LigneExercice from "./LigneExercice";

/** Leçons affichées d'emblée sans filtre ; les plus anciennes s'affichent à la demande. */
export const LECONS_VISIBLES = 5;

const FILTRES: { valeur: FiltreStatut; libelle: string }[] = [
  { valeur: "TOUS", libelle: "Tous" },
  { valeur: "A_FAIRE", libelle: STATUT_EXERCICE_LABELS.A_FAIRE },
  { valeur: "A_REVOIR", libelle: STATUT_EXERCICE_LABELS.A_REVOIR },
  { valeur: "REUSSI", libelle: "Réussis" },
];

/**
 * US42 — Exercices du parcours avec leur statut, regroupés par leçon (la plus récente en premier).
 * Un filtre par statut aide à retrouver les exercices à faire ou à revoir.
 */
export default function ListeExercices({ exercices }: { exercices: ExerciceParcours[] }) {
  const [filtre, setFiltre] = useState<FiltreStatut>("TOUS");
  const [toutAfficher, setToutAfficher] = useState(false);
  const compte = compterParStatut(exercices);
  const visibles = filtre === "TOUS" ? exercices : exercices.filter((e) => e.statut === filtre);
  const toutesLesLecons = exercicesParLecon(visibles);
  // Avec un filtre, toutes les leçons trouvées sont affichées
  const lecons = filtre === "TOUS" && !toutAfficher ? toutesLesLecons.slice(0, LECONS_VISIBLES) : toutesLesLecons;
  const masquees = toutesLesLecons.length - lecons.length;

  if (exercices.length === 0) {
    return <p className="card mt-4 text-content-secondary">Aucun exercice n&apos;a encore été ajouté à votre parcours.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      <div role="group" aria-label="Filtrer les exercices par statut" className="flex flex-wrap gap-2">
        {FILTRES.map(({ valeur, libelle }) => (
          <button
            key={valeur}
            type="button"
            aria-pressed={filtre === valeur}
            onClick={() => setFiltre(valeur)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-small font-semibold transition-colors ${
              filtre === valeur ? "border-primary bg-primary text-white" : "border-border bg-surface text-content hover:bg-background"
            }`}
          >
            {libelle}
            <span className={`rounded-full px-1.5 tabular-nums ${filtre === valeur ? "bg-white/20" : "bg-background"}`}>
              {compte[valeur]}
            </span>
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {visibles.length} exercice{visibles.length > 1 ? "s" : ""} affiché{visibles.length > 1 ? "s" : ""}
      </p>

      {lecons.length === 0 ? (
        <p className="card text-content-secondary">Aucun exercice avec ce statut.</p>
      ) : (
        <ul className="space-y-2">
          {lecons.map(({ numero, exercices: liste, faits }) => (
            // Leçons repliées (la leçon du jour est déjà détaillée plus haut) ; avec un filtre, les leçons trouvées sont ouvertes
            <li key={`${filtre}-${numero}`}>
              <details open={filtre !== "TOUS"} className="group card p-0">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold text-content">Leçon {numero}</span>
                  <span className="flex items-center gap-3 text-small text-content-secondary">
                    {filtre === "TOUS" && `${faits}/${liste.length} fait${faits > 1 ? "s" : ""}`}
                    <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <ul aria-label={`Exercices de la leçon ${numero}`} className="divide-y divide-border border-t border-border px-4">
                  {liste.map((exercice) => (
                    <LigneExercice key={exercice.idParcoursExercice} exercice={exercice} />
                  ))}
                </ul>
                <div className="border-t border-border px-4 py-3">
                  <Link href={ROUTES.apprenant.parcours.lecon(numero)} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:underline">
                    Ouvrir la leçon {numero} <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {masquees > 0 && (
        <button type="button" onClick={() => setToutAfficher(true)} className="btn-secondary w-full py-2.5">
          Afficher les {masquees} leçon{masquees > 1 ? "s" : ""} précédente{masquees > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
