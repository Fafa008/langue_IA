/** Échelle du référentiel avec le niveau atteint mis en évidence. */
export default function EchelleNiveaux({ niveaux, niveau }: { niveaux: readonly string[]; niveau: string }) {
  if (!niveaux.includes(niveau)) return null;
  const suivant = niveaux[niveaux.indexOf(niveau) + 1];
  return (
    <section className="card" aria-labelledby="result-scale-title">
      <h2 id="result-scale-title" className="text-small text-content-secondary">Échelle des niveaux</h2>
      <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {niveaux.map((n) => (
          <li
            key={n}
            aria-current={n === niveau ? "step" : undefined}
            className={`rounded-btn py-2.5 text-center font-semibold ${
              n === niveau ? "bg-primary text-white" : "bg-border text-content"
            }`}
          >
            {n}
          </li>
        ))}
      </ol>
      {suivant && <p className="mt-3 text-small text-content-secondary">Prochain niveau visé : {suivant}</p>}
    </section>
  );
}
