"use client";
import { ArrowLeft, BookOpen, FolderOpen, Layers, Loader2, PenLine, Route, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import LangueFlag from "@/components/admin/langues/LangueFlag";
import Alert from "@/components/ui/Alert";
import { useContenusLangue } from "@/hooks/useContenus";
import type { ContenusLangue, TypeEntite } from "@/lib/contenus/types";
import { ROUTES } from "@/lib/routes";
import OngletContenus from "./OngletContenus";
import { BadgeDonneesSimulees, EtatVide } from "./communs";

export const ONGLETS: { id: string; label: string; type: TypeEntite; icon: LucideIcon; compter: (c: ContenusLangue) => number }[] = [
  { id: "modules", label: "Modules", type: "module", icon: FolderOpen, compter: (c) => c.modules.length },
  { id: "lecons", label: "Leçons", type: "lecon", icon: BookOpen, compter: (c) => c.lecons.length },
  { id: "exercices", label: "Exercices", type: "activite", icon: PenLine, compter: (c) => c.activites.length },
  { id: "parcours", label: "Parcours", type: "parcours", icon: Route, compter: (c) => c.parcours.length },
];

function LienRetour() {
  return (
    <Link href={ROUTES.formateur.contenus.accueil} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
      <ArrowLeft size={18} aria-hidden />
      Toutes les langues
    </Link>
  );
}

interface LangueContenusViewProps {
  code: string;
  /** Onglet demandé par l'adresse (?onglet=lecons). */
  ongletInitial?: string;
}

/** Une langue : onglets Modules, Leçons, Exercices (activités) et Parcours. */
export default function LangueContenusView({ code, ongletInitial }: LangueContenusViewProps) {
  const contenus = useContenusLangue(code);
  const [onglet, setOnglet] = useState(() => ONGLETS.find((o) => o.id === ongletInitial)?.id ?? ONGLETS[0].id);
  const prefixe = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function choisir(id: string, focus = false) {
    setOnglet(id);
    // L'adresse garde l'onglet (rechargement, retour depuis le détail d'une leçon)
    window.history.replaceState(window.history.state, "", ROUTES.formateur.contenus.langue(code, id));
    if (focus) refs.current[id]?.focus();
  }

  /** Flèches gauche/droite, Début, Fin : navigation entre les onglets (modèle WAI-ARIA « Tabs »). */
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = ONGLETS.findIndex((o) => o.id === onglet);
    const cible = { ArrowRight: (i + 1) % ONGLETS.length, ArrowLeft: (i - 1 + ONGLETS.length) % ONGLETS.length, Home: 0, End: ONGLETS.length - 1 }[e.key];
    if (cible === undefined) return;
    e.preventDefault();
    choisir(ONGLETS[cible].id, true);
  }

  if (contenus.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        <LienRetour />
        <Alert className="mt-6">Les contenus de cette langue n&apos;ont pas pu être chargés. Réessayez.</Alert>
      </div>
    );
  }
  if (contenus.data === undefined) {
    return (
      <div className="flex justify-center py-20 text-content-secondary">
        <Loader2 className="animate-spin" aria-label="Chargement des contenus" />
      </div>
    );
  }
  const ctx = contenus.data;
  if (ctx === null) {
    return (
      <div className="mx-auto max-w-7xl">
        <LienRetour />
        <div className="card mt-6 p-0">
          <EtatVide icon={FolderOpen} titre="Langue introuvable.">
            Choisissez une langue dans la liste des contenus.
          </EtatVide>
        </div>
      </div>
    );
  }

  const actif = ONGLETS.find((o) => o.id === onglet)!;
  const sansNiveau = ctx.langue.niveaux.length === 0;

  return (
    <div className="mx-auto max-w-7xl">
      <LienRetour />

      <header className="mb-6 mt-4 flex flex-wrap items-start gap-4">
        <LangueFlag code={ctx.langue.code} size={48} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Contenus pédagogiques</p>
          <h1 className="mt-1">{ctx.langue.libelle}</h1>
          <p className="mt-1 text-content-secondary">
            {sansNiveau ? "Aucun niveau ouvert." : `Niveaux : ${ctx.langue.niveaux.map((n) => n.code).join(", ")}.`}
          </p>
        </div>
        <BadgeDonneesSimulees />
      </header>

      <div role="tablist" aria-label={`Contenus de la langue ${ctx.langue.libelle}`} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {ONGLETS.map(({ id, label, icon: Icon, compter }) => {
          const selectionne = id === onglet;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`${prefixe}-onglet-${id}`}
              aria-selected={selectionne}
              aria-controls={`${prefixe}-panneau-${id}`}
              tabIndex={selectionne ? 0 : -1}
              onClick={() => choisir(id)}
              onKeyDown={onKeyDown}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-semibold ${
                selectionne ? "border-primary text-primary" : "border-transparent text-content-secondary hover:border-border hover:text-primary"
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
              <span className="rounded-full bg-background px-2 text-small font-medium text-content-secondary ring-1 ring-inset ring-border">{compter(ctx)}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${prefixe}-panneau-${actif.id}`} aria-labelledby={`${prefixe}-onglet-${actif.id}`}>
        {sansNiveau ? (
          <div className="card p-0">
            <EtatVide icon={Layers} titre="Ajoutez d'abord des niveaux pour cette langue.">
              Aucun contenu ne peut être créé tant que la langue n&apos;a pas de niveau. Les niveaux sont ouverts par l&apos;administrateur
              (Langues et niveaux).
            </EtatVide>
          </div>
        ) : (
          // key : chaque onglet repart de ses propres filtres
          <OngletContenus key={actif.id} type={actif.type} ctx={ctx} />
        )}
      </div>
    </div>
  );
}
