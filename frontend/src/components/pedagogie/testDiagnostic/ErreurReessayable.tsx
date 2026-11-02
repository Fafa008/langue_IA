import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErreurReessayableProps {
  /** Message déjà rédigé pour l'apprenant (voir lib/erreursDiagnostic), sans détail technique. */
  message: string;
  onReessayer?: () => void;
  libelleBouton?: string;
}

/** Erreur maîtrisée : explication claire, réponses conservées et bouton de nouvelle tentative. */
export default function ErreurReessayable({ message, onReessayer, libelleBouton = "Réessayer" }: ErreurReessayableProps) {
  return (
    <div role="alert" data-testid="erreur-diagnostic" className="mt-4 rounded-card border border-error bg-error/5 p-4">
      <p className="flex items-start gap-2 font-medium text-error">
        <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
        {message}
      </p>
      {onReessayer && (
        <>
          <p className="mt-1 pl-7 text-small text-content-secondary">Vos réponses déjà saisies sont conservées.</p>
          <button type="button" onClick={onReessayer} className="btn-secondary mt-3 ml-7">
            <RotateCcw size={16} aria-hidden /> {libelleBouton}
          </button>
        </>
      )}
    </div>
  );
}
