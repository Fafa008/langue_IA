import { ArrowRight, Repeat, Sunrise } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import BarreProgression from "@/components/pedagogie/testDiagnostic/resultat/BarreProgression";
import { ROUTES } from "@/lib/routes";
import type { ExerciceParcours } from "@/types/parcours-personnalise";
import LigneExercice from "./LigneExercice";

interface LeconDuJourProps {
  numero: number;
  revision: boolean;
  /** Exercices de la leçon ; undefined pendant le chargement (l'état est alors passé en enfant). */
  exercices: ExerciceParcours[] | undefined;
  children?: ReactNode;
}

/** Leçon du jour (= leçon atteinte) et ses exercices, avec l'avancement de la leçon. */
export default function LeconDuJour({ numero, revision, exercices, children }: LeconDuJourProps) {
  const faits = exercices?.filter((e) => e.statut !== "A_FAIRE").length ?? 0;
  const total = exercices?.length ?? 0;
  const pourcentage = total ? Math.round((faits / total) * 100) : 0;

  return (
    <section aria-labelledby="titre-lecon-du-jour" className="card border-primary/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Sunrise size={15} aria-hidden /> Leçon du jour
          </p>
          <h2 id="titre-lecon-du-jour" className="mt-1 text-h3 text-content">
            Leçon {numero}
          </h2>
        </div>
        {revision && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-small font-semibold text-warning-dark">
            <Repeat size={14} aria-hidden /> Leçon de révision
          </span>
        )}
      </div>

      {children}

      {exercices && (
        <>
          {total > 0 ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1">
                  <BarreProgression
                    label={`Avancement de la leçon ${numero}`}
                    valeur={pourcentage}
                    valeurTexte={`${faits} exercice${faits > 1 ? "s" : ""} fait${faits > 1 ? "s" : ""} sur ${total}`}
                  />
                </div>
                <span className="text-small font-semibold tabular-nums text-content">
                  {faits}/{total} fait{faits > 1 ? "s" : ""}
                </span>
              </div>
              <ul aria-label="Exercices de la leçon du jour" className="mt-2 divide-y divide-border">
                {exercices.map((exercice) => (
                  <LigneExercice key={exercice.idParcoursExercice} exercice={exercice} />
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-content-secondary">Les exercices de cette leçon seront bientôt disponibles.</p>
          )}
          {total > 0 && (
            <Link href={ROUTES.apprenant.parcours.lecon(numero)} className="btn-primary mt-4 w-full sm:w-auto">
              {faits === 0 ? "Commencer la leçon" : faits < total ? "Continuer la leçon" : "Revoir la leçon"}
              <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </>
      )}
    </section>
  );
}
