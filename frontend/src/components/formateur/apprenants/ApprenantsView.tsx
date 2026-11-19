"use client";

import { useState } from "react";
import { APPRENANTS_SIMULES, type ApprenantFormateur } from "@/mocks/apprenants-formateur.mock";
import { filtrerApprenants, languesDe } from "@/lib/apprenants-formateur";

/** US49-FE — Vue formateur par apprenant. Données simulées, filtres locaux, détail simulé. */
export default function ApprenantsView({ apprenants = APPRENANTS_SIMULES }: { apprenants?: ApprenantFormateur[] }) {
  const [recherche, setRecherche] = useState("");
  const [codeLangue, setCodeLangue] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);

  const visibles = filtrerApprenants(apprenants, { recherche, codeLangue });
  const detail = apprenants.find((a) => a.id === choisi) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="eyebrow">Espace formateur</p>
        <h1 className="mt-2">Mes apprenants</h1>
        <p role="note" data-testid="donnees-simulees" className="mt-3 inline-block rounded-full bg-warning/15 px-3 py-1 text-small font-semibold text-warning-dark">
          Données simulées
        </p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="flex-1">
          <span className="sr-only">Rechercher un apprenant</span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un apprenant…"
            className="input w-full"
          />
        </label>
        <label className="md:w-64">
          <span className="sr-only">Filtrer par langue</span>
          <select value={codeLangue ?? ""} onChange={(e) => setCodeLangue(e.target.value || null)} className="input w-full">
            <option value="">Toutes les langues</option>
            {languesDe(apprenants).map((l) => (
              <option key={l.code} value={l.code}>
                {l.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="titre-liste" className="card p-0">
          <h2 id="titre-liste" className="sr-only">Liste des apprenants</h2>
          {visibles.length === 0 ? (
            <p className="p-6 text-content-secondary">Aucun apprenant ne correspond à ces filtres.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visibles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={choisi === a.id}
                    onClick={() => setChoisi(a.id)}
                    className={`flex w-full min-h-12 items-center justify-between gap-3 px-4 py-3 text-left ${choisi === a.id ? "bg-primary/5" : "hover:bg-background"}`}
                  >
                    <span className="font-semibold text-content">
                      {a.prenom} {a.nom}
                    </span>
                    <span className="text-small text-content-secondary">
                      {a.langue} · {a.niveauVise} · leçon {a.leconAtteinte}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titre-detail" className="card">
          <h2 id="titre-detail" className="text-h3 text-content">
            {detail ? `${detail.prenom} ${detail.nom}` : "Détail de l'apprenant"}
          </h2>
          {detail ? (
            <dl className="mt-4 grid grid-cols-2 gap-4 text-small">
              <div>
                <dt className="text-content-secondary">Langue</dt>
                <dd className="font-semibold">{detail.langue}</dd>
              </div>
              <div>
                <dt className="text-content-secondary">Niveau visé</dt>
                <dd className="font-semibold">{detail.niveauVise}</dd>
              </div>
              <div>
                <dt className="text-content-secondary">Leçon atteinte</dt>
                <dd className="font-semibold">{detail.leconAtteinte}</dd>
              </div>
              <div>
                <dt className="text-content-secondary">Phase</dt>
                <dd className="font-semibold">{detail.phase === "ACTIVE" ? "Mode actif" : "Mode passif"}</dd>
              </div>
              <div>
                <dt className="text-content-secondary">Exercices réussis</dt>
                <dd className="font-semibold">{detail.exercicesReussis}</dd>
              </div>
              <div>
                <dt className="text-content-secondary">À revoir</dt>
                <dd className="font-semibold">{detail.exercicesARevoir}</dd>
              </div>
              <div>
                <dt className="text-content-secondary">Score moyen</dt>
                <dd className="font-semibold">{detail.scoreMoyen}/100</dd>
              </div>
              <div>
                <dt className="text-content-secondary">Dernière activité</dt>
                <dd className="font-semibold">{detail.derniereActivite}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-content-secondary">Choisissez un apprenant dans la liste pour voir son détail.</p>
          )}
        </section>
      </div>
    </div>
  );
}
