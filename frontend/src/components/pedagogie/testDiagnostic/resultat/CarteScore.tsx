import type { ResultatTest } from "@/types/test-diagnostic";
import BarreProgression from "./BarreProgression";

export const pourcentage = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);
const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Score obtenu : sur 100 avec le backend (cadre connu), en bonnes réponses en mode démonstration. */
export default function CarteScore({ resultat }: { resultat: ResultatTest }) {
  const scoreGlobal = pourcentage(resultat.score, resultat.total);
  return (
    <section className="card" aria-labelledby="result-score-title">
      <h2 id="result-score-title" className="text-small text-content-secondary">Score obtenu</h2>
      <p data-testid="result-score" className="mt-2">
        <span className="text-6xl font-bold text-content">{nombre.format(resultat.score)}</span>{" "}
        <span className="text-h3 font-normal text-content-secondary">/ {resultat.total}</span>
      </p>
      <div className="mt-4">
        <BarreProgression label="Score global" valeur={scoreGlobal} />
      </div>
      <p className="mt-3 text-content">
        {resultat.cadre
          ? `${nombre.format(resultat.score)} % de bonnes réponses aux questions à choix`
          : `${resultat.score} réponses correctes sur ${resultat.total} · ${scoreGlobal} %`}
      </p>
    </section>
  );
}
