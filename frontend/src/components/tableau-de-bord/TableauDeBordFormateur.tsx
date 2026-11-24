"use client";

import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Presentation,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import IllustrationBanniereEspace from "./IllustrationBanniereEspace";

interface TableauDeBordFormateurProps {
  prenom: string;
}

const OUTILS = [
  {
    label: "Mes apprenants",
    description: "Consulter les profils et le suivi disponible",
    href: ROUTES.formateur.apprenants,
    Icon: UsersRound,
    etat: "Démonstration",
  },
  {
    label: "Synthèse des erreurs",
    description: "Repérer les difficultés récurrentes",
    href: ROUTES.formateur.syntheseErreurs,
    Icon: ClipboardCheck,
    etat: "Démonstration",
  },
  {
    label: "Mon profil",
    description: "Gérer les informations de votre compte",
    href: ROUTES.profil,
    Icon: UserRound,
  },
  {
    label: "Mes séances",
    description: "Préparation et suivi des séances",
    Icon: Presentation,
    etat: "Bientôt",
  },
  {
    label: "Ateliers",
    description: "Organisation et réservations",
    Icon: CalendarDays,
    etat: "Bientôt",
  },
];

export default function TableauDeBordFormateur({ prenom }: TableauDeBordFormateurProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section
        aria-labelledby="titre-accueil-formateur"
        className="relative isolate overflow-hidden rounded-card border border-primary/10 bg-gradient-to-br from-primary/10 via-surface to-background p-6 shadow-card sm:p-8"
      >
        <div className="relative z-10 max-w-2xl md:max-w-[58%]">
          <p className="eyebrow">Espace professionnel</p>
          <h1 id="titre-accueil-formateur" className="mt-2">
            Bonjour, {prenom}
          </h1>
          <p className="mt-3 max-w-xl text-base text-content-secondary">
            Retrouvez vos outils de suivi et d&apos;analyse pour accompagner vos apprenants au quotidien.
          </p>
          <Link href={ROUTES.formateur.apprenants} className="btn-primary mt-6">
            Consulter mes apprenants <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <IllustrationBanniereEspace bulleGauche="Suivi" bulleDroite="Analyse" />
      </section>

      <section aria-labelledby="titre-outils-formateur">
        <div className="mb-4 flex items-center gap-2">
          <Presentation size={22} className="text-primary" aria-hidden />
          <h2 id="titre-outils-formateur" className="text-h3 text-primary">
            Vos outils
          </h2>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OUTILS.map(({ label, description, href, Icon, etat }) => {
            const contenu = (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary/10 text-primary">
                  <Icon size={22} aria-hidden />
                </span>
                <span className="flex flex-1 items-end justify-between gap-3">
                  <span>
                    <span className="block font-semibold text-content">{label}</span>
                    <span className="mt-1 block text-small text-content-secondary">{description}</span>
                  </span>
                  {etat ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[0.6875rem] font-semibold ${
                        etat === "Démonstration"
                          ? "bg-warning/15 text-warning-dark"
                          : "bg-background text-content-secondary"
                      }`}
                    >
                      {etat}
                    </span>
                  ) : (
                    <ArrowRight size={18} className="shrink-0 text-primary" aria-hidden />
                  )}
                </span>
              </>
            );

            return (
              <li key={label}>
                {href ? (
                  <Link
                    href={href}
                    className="card group flex h-full min-h-36 flex-col justify-between gap-5 transition-shadow hover:border-primary/40 hover:shadow-lg"
                  >
                    {contenu}
                  </Link>
                ) : (
                  <div aria-disabled="true" className="card flex h-full min-h-36 flex-col justify-between gap-5 opacity-75">
                    {contenu}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <aside role="note" className="rounded-card border border-border bg-surface p-5 text-small text-content-secondary">
        Les outils marqués « Démonstration » affichent actuellement des données simulées. Les séances et les ateliers
        seront accessibles lorsque leurs fonctionnalités seront disponibles.
      </aside>
    </div>
  );
}
