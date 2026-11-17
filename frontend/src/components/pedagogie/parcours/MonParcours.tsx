"use client";

import { BookOpenText, CalendarDays, Ear, Flag, LayoutGrid, Mic2, Repeat, Target } from "lucide-react";
import Link from "next/link";
import { useExercicesParcours, useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { useSession } from "@/hooks/useSession";
import { ApiError } from "@/lib/api-client";
import { formatDateCourte } from "@/lib/date";
import {
  leconsAvantPhaseActive,
  messageErreurParcours,
  PHASES,
  STATUT_PARCOURS_LABELS,
} from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import type { ParcoursPersonnalise, PhaseParcours } from "@/types/parcours-personnalise";
import { Chargement, ErreurChargement } from "./communs";
import LeconDuJour from "./LeconDuJour";
import ListeExercices from "./ListeExercices";
import ListeModules from "./ListeModules";

/**
 * US41/US42 — « Mon parcours » : le parcours, la leçon atteinte, le mode passif/actif,
 * puis les exercices de la leçon du jour et de tout le parcours avec leur statut.
 */
export default function MonParcours() {
  const parcours = useParcoursPersonnalise();

  if (parcours.isPending) return <Chargement label="Chargement de votre parcours…" />;
  if (parcours.isError) {
    if (parcours.error instanceof ApiError && parcours.error.status === 404) return <AucunParcours />;
    return (
      <ErreurChargement
        message={messageErreurParcours(parcours.error, "Le chargement de votre parcours")}
        onReessayer={() => void parcours.refetch()}
      />
    );
  }
  return <ContenuParcours parcours={parcours.data} />;
}

function ContenuParcours({ parcours }: { parcours: ParcoursPersonnalise }) {
  const exercices = useExercicesParcours(parcours.idParcours);
  // Un seul état de chargement ou d'erreur, affiché dans la leçon du jour ; la liste complète attend les données
  const etatExercices = exercices.isPending ? (
    <Chargement label="Chargement des exercices…" />
  ) : exercices.isError ? (
    <ErreurChargement
      message={messageErreurParcours(exercices.error, "Le chargement des exercices")}
      onReessayer={() => void exercices.refetch()}
    />
  ) : null;

  return (
    <div className="space-y-8">
      <EnTete parcours={parcours} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1.4fr]">
        <CarteLeconAtteinte parcours={parcours} />
        <CarteMode phase={parcours.phase} leconAtteinte={parcours.leconAtteinte} />
      </div>

      <LeconDuJour
        numero={parcours.leconAtteinte}
        revision={parcours.estLeconDeRevision}
        exercices={exercices.data?.filter((e) => e.numeroLecon === parcours.leconAtteinte)}
      >
        {etatExercices}
      </LeconDuJour>

      <section aria-labelledby="titre-modules">
        <h2 id="titre-modules" className="flex items-center gap-2 text-h3 text-primary">
          <LayoutGrid size={22} aria-hidden /> Mes modules
        </h2>
        <ListeModules modules={parcours.modules} leconAtteinte={parcours.leconAtteinte} />
      </section>

      {exercices.data && (
        <section aria-labelledby="titre-exercices">
          <h2 id="titre-exercices" className="flex items-center gap-2 text-h3 text-primary">
            <BookOpenText size={22} aria-hidden /> Tous les exercices du parcours
          </h2>
          <ListeExercices exercices={exercices.data} />
        </section>
      )}
    </div>
  );
}

function EnTete({ parcours }: { parcours: ParcoursPersonnalise }) {
  const { utilisateur, ready } = useSession();
  const prenom = ready ? utilisateur?.prenom : undefined;
  return (
    <section aria-labelledby="titre-parcours" className="rounded-card bg-primary p-6 text-white shadow-card md:p-8">
      <p className="text-small font-semibold uppercase tracking-widest text-white/75">Mon parcours</p>
      <h1 id="titre-parcours" className="mt-2 text-[1.75rem] leading-tight text-white md:text-h2">
        Bonjour{prenom ? `, ${prenom}` : ""} !
      </h1>
      <p className="mt-2 text-base">
        Votre parcours de <strong>{parcours.langue.libelle}</strong> vers le niveau <strong>{parcours.niveauVise}</strong>.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2 text-small">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-primary">
          <Flag size={14} aria-hidden /> Parcours {STATUT_PARCOURS_LABELS[parcours.statut].toLowerCase()}
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
          <CalendarDays size={14} aria-hidden /> Commencé le {formatDateCourte(parcours.dateCreation)}
        </li>
      </ul>
    </section>
  );
}

function CarteLeconAtteinte({ parcours }: { parcours: ParcoursPersonnalise }) {
  const { niveauxCadre, niveauDepart, niveauVise, cadre } = parcours;
  return (
    <section aria-labelledby="titre-lecon-atteinte" className="card flex flex-col gap-5">
      <div>
        <h2 id="titre-lecon-atteinte" className="text-small font-semibold uppercase tracking-widest text-content-secondary">
          Leçon atteinte
        </h2>
        <p className="mt-1 text-h1 font-bold text-primary">Leçon {parcours.leconAtteinte}</p>
      </div>
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Target size={18} className="text-primary" aria-hidden /> Objectif {cadre === "CECRL" ? "CECRL" : cadre}
        </h3>
        <ol aria-label={`Niveaux du ${cadre}`} className="mt-3 flex flex-wrap gap-2">
          {niveauxCadre.map((niveau) => {
            const vise = niveau === niveauVise;
            const depart = niveau === niveauDepart;
            return (
              <li
                key={niveau}
                aria-current={vise ? "step" : undefined}
                className={`flex min-w-12 flex-col items-center rounded-btn border px-2.5 py-1.5 text-small font-semibold ${
                  vise ? "border-primary bg-primary text-white" : depart ? "border-primary text-primary" : "border-border text-content-secondary"
                }`}
              >
                {niveau}
                {(vise || depart) && <span className="text-[0.625rem] font-medium">{vise ? "Objectif" : "Départ"}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Mode passif / actif : les deux phases de la méthode, la phase en cours mise en évidence (texte, pas seulement couleur). */
function CarteMode({ phase, leconAtteinte }: { phase: PhaseParcours; leconAtteinte: number }) {
  const restantes = leconsAvantPhaseActive(leconAtteinte);
  return (
    <section aria-labelledby="titre-mode" className="card">
      <h2 id="titre-mode" className="text-small font-semibold uppercase tracking-widest text-content-secondary">
        Mode d&apos;apprentissage
      </h2>
      <p className="mt-1 text-h2 font-bold text-primary">{PHASES[phase].libelle}</p>

      <ol aria-label="Phases du parcours" className="mt-4 grid grid-cols-2 gap-2">
        {(["PASSIVE", "ACTIVE"] as const).map((p) => {
          const courante = p === phase;
          const Icone = p === "PASSIVE" ? Ear : Mic2;
          return (
            <li
              key={p}
              aria-current={courante ? "step" : undefined}
              className={`rounded-btn border p-3 ${courante ? "border-primary bg-primary/5" : "border-border text-content-secondary"}`}
            >
              <span className={`flex items-center gap-2 font-semibold ${courante ? "text-primary" : ""}`}>
                <Icone size={18} aria-hidden /> {PHASES[p].libelle}
              </span>
              <span className="mt-0.5 block text-small">{PHASES[p].periode}</span>
              {courante && <span className="mt-1 block text-small font-semibold text-primary">Votre mode actuel</span>}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-content">{PHASES[phase].explication}</p>
      {phase === "PASSIVE" && restantes > 0 && (
        <p className="mt-2 flex items-center gap-2 text-small text-content-secondary">
          <Repeat size={15} aria-hidden /> Encore {restantes} leçon{restantes > 1 ? "s" : ""} avant le mode actif.
        </p>
      )}
    </section>
  );
}

function AucunParcours() {
  return (
    <section className="card mx-auto max-w-xl text-center">
      <h1 className="text-h2">Mon parcours</h1>
      <p className="mt-3 text-content-secondary">
        Votre parcours personnalisé est construit à partir du test de positionnement. Passez-le pour commencer.
      </p>
      <Link href={ROUTES.apprenant.testDiagnostic.demarrage} className="btn-primary mt-6">
        Passer le test de positionnement
      </Link>
    </section>
  );
}
