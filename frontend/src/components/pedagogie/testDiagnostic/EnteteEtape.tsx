import { ChevronLeft, Timer } from "lucide-react";
import { ETAPES, formaterDuree } from "@/lib/etapesTest";
import type { EtapeTest } from "@/types/test-diagnostic";

interface EnteteEtapeProps {
  etape: EtapeTest;
  /** « Étape 2/4 » */
  position: { numero: number; total: number };
  /** Question affichée, questions déjà validées et total du test. */
  progression: { numero: number; faites: number; total: number };
  /** null tant que le compte à rebours n'a pas démarré. */
  secondesRestantes: number | null;
  /** Temps restant sur l'exercice en cours (affiché en plus du temps global). */
  secondesQuestion?: number | null;
  onQuitter: () => void;
  quitterDesactive?: boolean;
}

/** Seuil à partir duquel le temps restant est signalé en orange. */
const ALERTE_SECONDES = 120;

/** En-tête du test : retour, étape en cours, temps restant et progression globale. */
export default function EnteteEtape({
  etape,
  position,
  progression,
  secondesRestantes,
  secondesQuestion = null,
  onQuitter,
  quitterDesactive = false,
}: EnteteEtapeProps) {
  const pourcentage = progression.total > 0 ? Math.round((progression.faites / progression.total) * 100) : 0;
  const bientotFini = secondesRestantes !== null && secondesRestantes <= ALERTE_SECONDES;

  return (
    <header className="mb-6" data-testid="entete-etape" data-etape={etape}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="test-back"
          aria-label="Quitter le test"
          onClick={onQuitter}
          disabled={quitterDesactive}
          className="-ml-2 rounded-full p-2 text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
        <h1 className="flex-1 text-h4 font-semibold text-content sm:text-h3" data-testid="etape-titre">
          Étape {position.numero}/{position.total} : {ETAPES[etape].libelle}
        </h1>
        {secondesRestantes !== null && (
          <p
            role="timer"
            aria-label={`Temps restant : ${formaterDuree(secondesRestantes)}`}
            data-testid="temps-restant"
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-small font-semibold tabular-nums ${
              bientotFini ? "bg-warning/15 text-warning-dark" : "bg-primary/10 text-primary"
            }`}
          >
            <Timer size={16} aria-hidden />
            {formaterDuree(secondesRestantes)}
          </p>
        )}
        {secondesQuestion !== null && (
          <p
            role="timer"
            aria-label={`Temps restant pour cet exercice : ${formaterDuree(secondesQuestion)}`}
            data-testid="temps-question"
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-small font-semibold tabular-nums text-content-secondary sm:flex"
          >
            <Timer size={16} aria-hidden />
            Exercice : {formaterDuree(secondesQuestion)}
          </p>
        )}
      </div>

      <div
        role="progressbar"
        aria-label="Progression du test"
        aria-valuemin={0}
        aria-valuemax={progression.total}
        aria-valuenow={progression.faites}
        aria-valuetext={`${pourcentage} %`}
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pourcentage}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-small text-content-secondary">
        <span data-testid="progress-label">Question {progression.numero} sur {progression.total}</span>
        {secondesQuestion !== null && (
          <span className="tabular-nums sm:hidden" data-testid="temps-question-mobile">
            Exercice : {formaterDuree(secondesQuestion)}
          </span>
        )}
        <span className="font-semibold text-primary">{pourcentage} %</span>
      </p>
    </header>
  );
}
