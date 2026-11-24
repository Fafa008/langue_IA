"use client";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import { useContenusLangue } from "@/hooks/useContenus";
import { phaseAssimil } from "@/lib/contenus/validation";
import { formatDateCourte } from "@/lib/date";
import { ROUTES } from "@/lib/routes";
import OngletContenus from "./OngletContenus";
import { BadgeDonneesSimulees, EtatVide, StatutContenuBadge } from "./communs";

/** Détail d'une leçon : ses informations et la liste de ses activités (ajout, modification, archivage). */
export default function LeconDetailView({ code, idLecon }: { code: string; idLecon: string }) {
  const contenus = useContenusLangue(code);
  const retour = (
    <Link href={ROUTES.formateur.contenus.langue(code, "lecons")} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
      <ArrowLeft size={18} aria-hidden />
      Leçons {contenus.data ? `– ${contenus.data.langue.libelle}` : ""}
    </Link>
  );

  if (contenus.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        {retour}
        <Alert className="mt-6">La leçon n&apos;a pas pu être chargée. Réessayez.</Alert>
      </div>
    );
  }
  if (contenus.data === undefined) {
    return (
      <div className="flex justify-center py-20 text-content-secondary">
        <Loader2 className="animate-spin" aria-label="Chargement de la leçon" />
      </div>
    );
  }
  const ctx = contenus.data;
  const lecon = ctx?.lecons.find((l) => l.id === idLecon);
  if (!ctx || !lecon) {
    return (
      <div className="mx-auto max-w-7xl">
        {retour}
        <div className="card mt-6 p-0">
          <EtatVide icon={BookOpen} titre="Leçon introuvable.">
            Elle a peut-être été supprimée.
          </EtatVide>
        </div>
      </div>
    );
  }

  const moduleLecon = ctx.modules.find((m) => m.id === lecon.idModule);
  const niveau = ctx.langue.niveaux.find((n) => n.id === lecon.idNiveau);
  const infos: [string, string][] = [
    ["Module", moduleLecon ? `${moduleLecon.ordre}. ${moduleLecon.titre}` : "—"],
    ["Niveau", niveau?.code ?? "—"],
    ["Numéro d'ordre", String(lecon.ordre)],
    ["Phase Assimil", phaseAssimil(lecon.ordre) === "active" ? "Active" : "Passive"],
    ["Dernière modification", `${formatDateCourte(lecon.modifieLe)}, par ${lecon.modifiePar}`],
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {retour}

      <header className="mb-6 mt-4">
        <p className="eyebrow">Leçon – {ctx.langue.libelle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1>{lecon.titre}</h1>
          <StatutContenuBadge statut={lecon.statut} />
        </div>
        <div className="mt-3">
          <BadgeDonneesSimulees />
        </div>
      </header>

      <section aria-label="Informations de la leçon" className="card">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {infos.map(([terme, valeur]) => (
            <div key={terme}>
              <dt className="text-small font-medium text-content-secondary">{terme}</dt>
              <dd className="text-content">{valeur}</dd>
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-small font-medium text-content-secondary">Description</dt>
            <dd className="whitespace-pre-line text-content">{lecon.description || "Aucune description."}</dd>
          </div>
        </dl>
      </section>

      <h2 className="mb-4 mt-8 text-h3 text-primary">Activités de la leçon</h2>
      <OngletContenus type="activite" ctx={ctx} idLecon={lecon.id} />
    </div>
  );
}
