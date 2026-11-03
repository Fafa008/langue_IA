import { PHASES_ASSIMIL } from "@/lib/resultatDiagnostic";
import type { CadreReference, PhaseAssimil } from "@/types/test-diagnostic";

const DESCRIPTIONS: Record<string, string> = {
  A1: "Débutant",
  A2: "Élémentaire",
  B1: "Intermédiaire",
  B2: "Intermédiaire supérieur",
  C1: "Avancé",
  C2: "Maîtrise",
};

interface CarteNiveauProps {
  niveau: string;
  referentiel: CadreReference;
  libelleLangue: string;
  phase?: PhaseAssimil;
}

/** Niveau estimé et phase Assimil conseillée pour démarrer le parcours. */
export default function CarteNiveau({ niveau, referentiel, libelleLangue, phase }: CarteNiveauProps) {
  return (
    <section className="flex flex-col rounded-card bg-primary p-6 text-white shadow-card" aria-labelledby="result-level-title">
      <h2 id="result-level-title" className="text-small text-white/70">
        Votre niveau en {libelleLangue.toLowerCase()}
      </h2>
      <p className="mt-2 flex items-center gap-4">
        <span data-testid="result-level" className="text-6xl font-bold">{niveau}</span>
        <span data-testid="result-framework" className="rounded-full bg-white px-3 py-1 text-small font-semibold text-primary">
          {referentiel}
        </span>
      </p>
      <p className="mt-4 text-h4">{DESCRIPTIONS[niveau] ?? "Niveau de référence estimé"}</p>

      <div className="mt-5 border-t border-white/20 pt-4" data-testid="result-phase">
        <p className="text-small text-white/70">Phase de la méthode Assimil</p>
        {phase ? (
          <>
            <p className="mt-1 font-semibold">{PHASES_ASSIMIL[phase].libelle}</p>
            <p className="mt-1 text-small text-white/80">{PHASES_ASSIMIL[phase].description}</p>
          </>
        ) : (
          <p className="mt-1 text-small text-white/80">Non déterminée : elle sera précisée par l&apos;analyse complète de vos réponses.</p>
        )}
      </div>
    </section>
  );
}
