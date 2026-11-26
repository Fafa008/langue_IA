"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  MessageCircle,
  Route,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { ApiError } from "@/lib/api-client";
import {
  DOMAINE_FAIBLESSE_LABELS,
  messageErreurParcours,
  PHASES,
  STATUT_PARCOURS_LABELS,
  TYPE_EXERCICE_LABELS,
} from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import { Chargement, ErreurChargement } from "@/components/pedagogie/parcours/communs";
import IllustrationBanniereEspace from "./IllustrationBanniereEspace";

interface TableauDeBordApprenantProps {
  prenom: string;
}

const ACCES_RAPIDES = [
  {
    label: "Mon parcours",
    description: "Retrouver votre prochaine leçon",
    href: ROUTES.apprenant.parcours.accueil,
    Icon: Route,
  },
  {
    label: "Test de positionnement",
    description: "Évaluer votre niveau",
    href: ROUTES.apprenant.testDiagnostic.demarrage,
    Icon: ClipboardCheck,
  },
  {
    label: "Tuteur IA",
    description: "Pratiquer et poser vos questions",
    href: ROUTES.apprenant.chat,
    Icon: MessageCircle,
  },
  {
    label: "Mon profil",
    description: "Gérer vos informations",
    href: ROUTES.profil,
    Icon: UserRound,
  },
];

export default function TableauDeBordApprenant({ prenom }: TableauDeBordApprenantProps) {
  const parcours = useParcoursPersonnalise();
  const sansParcours = parcours.isError && parcours.error instanceof ApiError && parcours.error.status === 404;
  const peutReprendre = parcours.isSuccess && parcours.data.statut === "EN_COURS";
  const hrefPrincipal = peutReprendre
    ? ROUTES.apprenant.parcours.lecon(parcours.data.leconAtteinte)
    : sansParcours
      ? ROUTES.apprenant.testDiagnostic.demarrage
      : ROUTES.apprenant.parcours.accueil;
  const textePrincipal = peutReprendre
    ? `Reprendre la leçon ${parcours.data.leconAtteinte}`
    : sansParcours
      ? "Faire mon test de positionnement"
      : "Ouvrir mon parcours";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section
        aria-labelledby="titre-accueil-apprenant"
        className="relative isolate overflow-hidden rounded-card border border-primary/10 bg-gradient-to-br from-primary/10 via-surface to-background p-6 shadow-card sm:p-8"
      >
        <div className="relative z-10 max-w-2xl md:max-w-[58%]">
          <p className="eyebrow">Votre espace d&apos;apprentissage</p>
          <h1 id="titre-accueil-apprenant" className="mt-2">
            Bonjour, {prenom} !
          </h1>
          <p className="mt-3 max-w-xl text-base text-content-secondary">
            Continuez à progresser dans vos langues, à votre rythme et avec l&apos;aide de votre tuteur IA.
          </p>
          <Link href={hrefPrincipal} className="btn-primary mt-6">
            {textePrincipal}
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <IllustrationBanniereEspace bulleGauche="Bonjour !" bulleDroite="Hello !" />
      </section>

      <section aria-labelledby="titre-acces-rapide">
        <div className="mb-4 flex items-center gap-2">
          <Zap size={22} className="text-primary" aria-hidden />
          <h2 id="titre-acces-rapide" className="text-h3 text-primary">
            Accès rapide
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ACCES_RAPIDES.map(({ label, description, href, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="card group flex h-full min-h-36 flex-col justify-between gap-5 transition-shadow hover:border-primary/40 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary/10 text-primary">
                  <Icon size={22} aria-hidden />
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span>
                    <span className="block font-semibold text-content">{label}</span>
                    <span className="mt-1 block text-small text-content-secondary">{description}</span>
                  </span>
                  <ArrowRight size={18} className="mb-0.5 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
          <li>
            <div aria-disabled="true" className="card flex h-full min-h-36 flex-col justify-between gap-5 opacity-75">
              <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-background text-content-secondary">
                <CalendarDays size={22} aria-hidden />
              </span>
              <span className="flex items-end justify-between gap-3">
                <span>
                  <span className="block font-semibold text-content">Ateliers</span>
                  <span className="mt-1 block text-small text-content-secondary">Réservation bientôt disponible</span>
                </span>
                <span className="shrink-0 rounded-full bg-background px-2 py-1 text-xs font-semibold text-content-secondary">
                  Bientôt
                </span>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <CarteParcours parcours={parcours} />
        <CarteRecommandations parcours={parcours} />
      </div>
    </div>
  );
}

function CarteParcours({ parcours }: { parcours: ReturnType<typeof useParcoursPersonnalise> }) {
  const sansParcours = parcours.isError && parcours.error instanceof ApiError && parcours.error.status === 404;

  return (
    <section aria-labelledby="titre-resume-parcours" className="card flex flex-col">
      <div className="flex items-center gap-2">
        <BookOpen size={21} className="text-primary" aria-hidden />
        <h2 id="titre-resume-parcours" className="text-h3 text-primary">
          Mon parcours
        </h2>
      </div>

      {parcours.isPending ? (
        <div className="mt-5">
          <Chargement label="Chargement de votre parcours…" />
        </div>
      ) : parcours.isSuccess ? (
        <div className="mt-5 flex flex-1 flex-col">
          <p className="eyebrow">Parcours {STATUT_PARCOURS_LABELS[parcours.data.statut].toLowerCase()}</p>
          <h3 className="mt-2 text-h3 text-content">
            {parcours.data.langue.libelle} · objectif {parcours.data.niveauVise}
          </h3>
          {parcours.data.niveauDepart && (
            <p className="mt-1 text-small text-content-secondary">Niveau de départ : {parcours.data.niveauDepart}</p>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-btn bg-background p-3">
              <dt className="text-small text-content-secondary">Leçon du jour</dt>
              <dd className="mt-1 font-semibold text-content">Leçon {parcours.data.leconAtteinte}</dd>
            </div>
            <div className="rounded-btn bg-background p-3">
              <dt className="text-small text-content-secondary">Mode actuel</dt>
              <dd className="mt-1 font-semibold text-content">{PHASES[parcours.data.phase].libelle}</dd>
            </div>
          </dl>
          <Link
            href={
              parcours.data.statut === "EN_COURS"
                ? ROUTES.apprenant.parcours.lecon(parcours.data.leconAtteinte)
                : ROUTES.apprenant.parcours.accueil
            }
            className="btn-secondary mt-5 self-start px-4 py-2"
          >
            {parcours.data.statut === "EN_COURS" ? "Continuer ma leçon" : "Voir mon parcours"}{" "}
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      ) : sansParcours ? (
        <div className="mt-5 flex flex-1 flex-col items-start">
          <p className="text-content-secondary">Votre parcours personnalisé commencera après le test de positionnement.</p>
          <Link href={ROUTES.apprenant.testDiagnostic.demarrage} className="btn-primary mt-5">
            Passer le test <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="mt-5">
          <ErreurChargement
            message={messageErreurParcours(parcours.error, "Le chargement de votre parcours")}
            onReessayer={() => void parcours.refetch()}
          />
        </div>
      )}
    </section>
  );
}

function CarteRecommandations({ parcours }: { parcours: ReturnType<typeof useParcoursPersonnalise> }) {
  const recommandation = parcours.isSuccess ? parcours.data.recommandation : null;

  return (
    <section aria-labelledby="titre-recommandations-accueil" className="card flex flex-col">
      <div className="flex items-center gap-2">
        <Sparkles size={21} className="text-primary" aria-hidden />
        <h2 id="titre-recommandations-accueil" className="text-h3 text-primary">
          Recommandations personnalisées
        </h2>
      </div>

      {parcours.isPending ? (
        <div className="mt-5">
          <Chargement label="Chargement de vos recommandations…" />
        </div>
      ) : !parcours.isSuccess ? (
        <div className="mt-5 flex flex-1 flex-col items-start">
          <p className="text-content-secondary">
            Vos recommandations seront affichées ici lorsque votre parcours sera disponible.
          </p>
          {parcours.isError && parcours.error instanceof ApiError && parcours.error.status === 404 && (
            <Link href={ROUTES.apprenant.testDiagnostic.demarrage} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
              Commencer par le test <ArrowRight size={17} aria-hidden />
            </Link>
          )}
        </div>
      ) : recommandation ? (
        <div className="mt-5 flex flex-1 flex-col">
          <p className="text-content-secondary">{recommandation.resume}</p>
          {recommandation.statut === "PARTIEL" && (
            <p role="status" className="msg-warning mt-3">
              Analyse partielle : ces suggestions sont indicatives.
            </p>
          )}
          {recommandation.recommandations[0] ? (
            <div className="mt-4 rounded-btn border border-border bg-primary/5 p-4">
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 size={18} aria-hidden />
                {DOMAINE_FAIBLESSE_LABELS[recommandation.recommandations[0].domaine]} ·{" "}
                {TYPE_EXERCICE_LABELS[recommandation.recommandations[0].typeExercice]}
              </p>
              <p className="mt-2 text-content">{recommandation.recommandations[0].action}</p>
            </div>
          ) : (
            <p className="mt-4 flex items-start gap-2 text-small text-content-secondary">
              <CircleHelp size={17} className="mt-0.5 shrink-0" aria-hidden />
              Continuez vos exercices pour obtenir de nouvelles suggestions.
            </p>
          )}
          <Link
            href={ROUTES.apprenant.parcours.accueil}
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline"
          >
            Voir mon parcours <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col items-start">
          <p className="text-content-secondary">Aucune recommandation enregistrée pour le moment.</p>
          <Link
            href={ROUTES.apprenant.parcours.accueil}
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline"
          >
            Découvrir mon parcours <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
