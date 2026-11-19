"use client";

import { ERREURS_SIMULEES, type ErreurRecurrente } from "@/mocks/synthese-erreurs-formateur.mock";

/** US52-FE — Page formateur : les trois erreurs récurrentes, leur impact et des conseils. Données simulées. */
export default function SyntheseErreursView({ erreurs = ERREURS_SIMULEES }: { erreurs?: ErreurRecurrente[] }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Espace formateur</p>
        <h1 className="mt-2">Synthèse des erreurs</h1>
        <p role="note" data-testid="synthese-simulee" className="mt-3 inline-block rounded-full bg-warning/15 px-3 py-1 text-small font-semibold text-warning-dark">
          Synthèse simulée
        </p>
      </header>

      <section aria-labelledby="titre-erreurs" className="space-y-4">
        <h2 id="titre-erreurs" className="text-h3 text-content">Les trois erreurs les plus fréquentes</h2>
        <ol className="space-y-4">
          {erreurs.slice(0, 3).map((erreur, index) => (
            <li key={erreur.id} className="card">
              <p className="text-small text-content-secondary">
                {index + 1}. {erreur.domaine} · {erreur.apprenantsConcernes} apprenant{erreur.apprenantsConcernes > 1 ? "s" : ""} concerné{erreur.apprenantsConcernes > 1 ? "s" : ""}
              </p>
              <h3 className="mt-1 text-h3 text-content">{erreur.titre}</h3>
              <p className="mt-2 text-content">
                <span className="font-semibold">Exemple :</span> {erreur.exemple}
              </p>
              <p className="mt-2 text-content">
                <span className="font-semibold">Conseil :</span> {erreur.conseil}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="titre-bilan-reel" className="card" aria-disabled="true">
        <h2 id="titre-bilan-reel" className="flex items-center gap-3 text-h3 text-content">
          Bilan réel des sessions
          <span className="rounded-full bg-background px-2.5 py-0.5 text-small font-semibold text-content-secondary">Bientôt</span>
        </h2>
        <p className="mt-2 text-content-secondary">Le bilan réel des erreurs sera disponible après la livraison du bilan des sessions.</p>
      </section>
    </div>
  );
}
