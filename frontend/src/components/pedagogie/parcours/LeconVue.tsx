"use client";

import { ArrowRight, CheckCircle2, Repeat } from "lucide-react";
import Link from "next/link";
import BarreProgression from "@/components/pedagogie/testDiagnostic/resultat/BarreProgression";
import { useLeconParcours, useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { messageErreurParcours, moduleDeLecon } from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import type { ParcoursPersonnalise } from "@/types/parcours-personnalise";
import { Chargement, ErreurChargement, LienRetour } from "./communs";
import ExerciceCarte from "./exercices/ExerciceCarte";

/** Page d'une leçon : ses exercices (écrit, écoute, oral, conversation avec le professeur IA), corrigés un par un. */
export default function LeconVue({ numero }: { numero: number }) {
  const parcours = useParcoursPersonnalise();
  if (parcours.isPending) return <Chargement label="Chargement de la leçon…" />;
  if (parcours.isError) {
    return (
      <ErreurChargement
        message={messageErreurParcours(parcours.error, "Le chargement de la leçon")}
        onReessayer={() => void parcours.refetch()}
      />
    );
  }
  return <ContenuLecon parcours={parcours.data} numero={numero} />;
}

function ContenuLecon({ parcours, numero }: { parcours: ParcoursPersonnalise; numero: number }) {
  const lecon = useLeconParcours(parcours.idParcours, numero);
  const moduleCourant = moduleDeLecon(parcours.modules, numero);
  const retour = moduleCourant ? ROUTES.apprenant.parcours.module(moduleCourant.numero) : ROUTES.apprenant.parcours.accueil;

  const exercices = lecon.data?.exercices ?? [];
  const faits = exercices.filter((e) => e.statut !== "A_FAIRE").length;
  const terminee = exercices.length > 0 && faits === exercices.length;
  const suivanteOuverte = parcours.leconAtteinte > numero;

  return (
    <div className="space-y-6">
      <LienRetour href={retour}>{moduleCourant ? `Module ${moduleCourant.numero} : ${moduleCourant.titre}` : "Mon parcours"}</LienRetour>

      <header className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {moduleCourant && <p className="eyebrow">Module {moduleCourant.numero} · {moduleCourant.titre}</p>}
            <h1 className="mt-1 text-[1.5rem] leading-tight md:text-h2">Leçon {numero}</h1>
          </div>
          {lecon.data?.estLeconDeRevision && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-small font-semibold text-warning-dark">
              <Repeat size={14} aria-hidden /> Leçon de révision
            </span>
          )}
        </div>
        {lecon.data && (
          <div className="mt-4 flex items-center gap-3 text-small">
            <span className="flex-1">
              <BarreProgression
                label={`Avancement de la leçon ${numero}`}
                valeur={exercices.length ? Math.round((faits / exercices.length) * 100) : 0}
                valeurTexte={`${faits} exercice${faits > 1 ? "s" : ""} fait${faits > 1 ? "s" : ""} sur ${exercices.length}`}
              />
            </span>
            <span className="font-semibold tabular-nums">
              {faits}/{exercices.length} fait{faits > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </header>

      {lecon.isPending ? (
        <Chargement label="Chargement des exercices…" />
      ) : lecon.isError ? (
        <ErreurChargement
          message={messageErreurParcours(lecon.error, "Le chargement de la leçon")}
          onReessayer={() => void lecon.refetch()}
        />
      ) : (
        <ol aria-label={`Exercices de la leçon ${numero}`} className="space-y-4">
          {exercices.map((exercice) => (
            <ExerciceCarte key={exercice.idParcoursExercice} exercice={exercice} idParcours={parcours.idParcours} langue={lecon.data.langue} />
          ))}
        </ol>
      )}

      {terminee && (
        <section role="status" className="card flex flex-wrap items-center gap-4 border-success/40 bg-success/5">
          <CheckCircle2 size={28} className="shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="text-h4 font-semibold text-success-dark">Leçon terminée !</h2>
            <p className="text-small text-content-secondary">
              {suivanteOuverte ? "La leçon suivante est ouverte." : "Bravo, vous avez terminé votre parcours."}
            </p>
          </div>
          {suivanteOuverte && (
            <Link href={ROUTES.apprenant.parcours.lecon(numero + 1)} className="btn-primary px-4 py-2">
              Leçon {numero + 1} <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
