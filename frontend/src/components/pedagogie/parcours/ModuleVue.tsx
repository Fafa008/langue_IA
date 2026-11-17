"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import BarreProgression from "@/components/pedagogie/testDiagnostic/resultat/BarreProgression";
import { useExercicesParcours, useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import {
  leconsDuModule,
  messageErreurParcours,
  progressionModule,
  statutLecon,
  statutModule,
} from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import type { ExerciceParcours, ModuleParcours, ParcoursPersonnalise } from "@/types/parcours-personnalise";
import { Chargement, ErreurChargement, LienRetour } from "./communs";
import { ICONES_TYPE } from "./LigneExercice";
import { StatutEtapeBadge } from "./ListeModules";

/** Page d'un module : ses leçons avec leur statut, et l'accès à chacune. */
export default function ModuleVue({ numero }: { numero: number }) {
  const parcours = useParcoursPersonnalise();

  return (
    <div className="space-y-6">
      <LienRetour href={ROUTES.apprenant.parcours.accueil}>Mon parcours</LienRetour>
      {parcours.isPending ? (
        <Chargement label="Chargement du module…" />
      ) : parcours.isError ? (
        <ErreurChargement
          message={messageErreurParcours(parcours.error, "Le chargement du module")}
          onReessayer={() => void parcours.refetch()}
        />
      ) : (
        <ContenuModule parcours={parcours.data} numero={numero} />
      )}
    </div>
  );
}

function ContenuModule({ parcours, numero }: { parcours: ParcoursPersonnalise; numero: number }) {
  const exercices = useExercicesParcours(parcours.idParcours);
  const moduleCourant = parcours.modules.find((m) => m.numero === numero);
  if (!moduleCourant) return <ErreurChargement message={`Le module ${numero} n'existe pas dans votre parcours.`} />;

  const statut = statutModule(moduleCourant, parcours.leconAtteinte);
  const progression = progressionModule(moduleCourant, parcours.leconAtteinte);
  const precedent = parcours.modules.find((m) => m.numero === numero - 1);
  const suivant = parcours.modules.find((m) => m.numero === numero + 1);

  return (
    <>
      <header className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              Module {moduleCourant.numero} · Leçons {moduleCourant.premiereLecon} à {moduleCourant.derniereLecon}
            </p>
            <h1 className="mt-1 text-[1.5rem] leading-tight md:text-h2">{moduleCourant.titre}</h1>
            <p className="mt-1 text-content-secondary">{moduleCourant.description}</p>
          </div>
          <StatutEtapeBadge statut={statut} />
        </div>
        <div className="mt-4 flex items-center gap-3 text-small">
          <span className="flex-1">
            <BarreProgression label={`Progression du module ${moduleCourant.numero}`} valeur={progression} />
          </span>
          <span className="font-semibold tabular-nums">{progression} %</span>
        </div>
      </header>

      {exercices.isError && (
        <ErreurChargement
          message={messageErreurParcours(exercices.error, "Le chargement des exercices")}
          onReessayer={() => void exercices.refetch()}
        />
      )}

      <section aria-labelledby="titre-lecons-module">
        <h2 id="titre-lecons-module" className="text-h3 text-primary">
          Les leçons du module
        </h2>
        <ol className="mt-4 space-y-3">
          {leconsDuModule(moduleCourant).map((lecon) => (
            <CarteLecon
              key={lecon}
              numero={lecon}
              leconAtteinte={parcours.leconAtteinte}
              exercices={exercices.data?.filter((e) => e.numeroLecon === lecon)}
            />
          ))}
        </ol>
      </section>

      <NavigationModules precedent={precedent} suivant={suivant} />
    </>
  );
}

function CarteLecon({ numero, leconAtteinte, exercices }: { numero: number; leconAtteinte: number; exercices?: ExerciceParcours[] }) {
  const statut = statutLecon(numero, leconAtteinte);
  const faits = exercices?.filter((e) => e.statut !== "A_FAIRE").length ?? 0;
  const types = [...new Set(exercices?.map((e) => e.type))];
  return (
    <li className={`card flex flex-wrap items-center gap-4 p-4 ${statut === "EN_COURS" ? "border-primary/40" : ""}`}>
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
          statut === "A_VENIR" ? "bg-border text-content-secondary" : "bg-primary text-white"
        }`}
      >
        {numero}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <h3 className="font-semibold">Leçon {numero}</h3>
        {statut === "A_VENIR" ? (
          <p className="text-small text-content-secondary">S&apos;ouvrira après la leçon {numero - 1}.</p>
        ) : exercices ? (
          <p className="flex flex-wrap items-center gap-2 text-small text-content-secondary">
            {faits}/{exercices.length} exercice{exercices.length > 1 ? "s" : ""} fait{faits > 1 ? "s" : ""}
            <span className="flex gap-1" aria-hidden>
              {types.map((type) => {
                const Icone = ICONES_TYPE[type];
                return <Icone key={type} size={14} className="text-primary" />;
              })}
            </span>
          </p>
        ) : null}
      </div>
      <StatutEtapeBadge statut={statut} />
      {statut !== "A_VENIR" && (
        <Link
          href={ROUTES.apprenant.parcours.lecon(numero)}
          aria-label={`${statut === "EN_COURS" ? "Continuer" : "Revoir"} la leçon ${numero}`}
          className={`${statut === "EN_COURS" ? "btn-primary" : "btn-secondary"} px-4 py-2`}
        >
          {statut === "EN_COURS" ? "Continuer" : "Revoir"} <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </li>
  );
}

function NavigationModules({ precedent, suivant }: { precedent?: ModuleParcours; suivant?: ModuleParcours }) {
  return (
    <nav aria-label="Autres modules" className="flex flex-wrap justify-between gap-3">
      {precedent ? (
        <Link href={ROUTES.apprenant.parcours.module(precedent.numero)} className="btn-secondary px-4 py-2">
          <ArrowLeft size={16} aria-hidden /> Module {precedent.numero} : {precedent.titre}
        </Link>
      ) : (
        <span />
      )}
      {suivant && (
        <Link href={ROUTES.apprenant.parcours.module(suivant.numero)} className="btn-secondary px-4 py-2">
          Module {suivant.numero} : {suivant.titre} <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </nav>
  );
}
