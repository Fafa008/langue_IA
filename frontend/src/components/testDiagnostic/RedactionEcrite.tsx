import { compterMots } from "@/lib/etapesTest";

interface RedactionEcriteProps {
  id: string;
  valeur: string;
  onChange: (texte: string) => void;
  /** Nombre de mots attendu au minimum (1 pour une réponse courte). */
  motsMinimum: number;
  disabled?: boolean;
}

/** Réponse écrite avec compteur de mots : la jauge se remplit jusqu'au minimum attendu. */
export default function RedactionEcrite({ id, valeur, onChange, motsMinimum, disabled = false }: RedactionEcriteProps) {
  const mots = compterMots(valeur);
  const atteint = mots >= motsMinimum;
  const avancement = Math.min(100, Math.round((mots / motsMinimum) * 100));
  const longue = motsMinimum > 1;

  return (
    <div className="mt-4">
      <label className="block font-semibold text-content" htmlFor={id}>
        Votre réponse
      </label>
      <textarea
        id={id}
        value={valeur}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={longue ? 8 : 3}
        maxLength={3000}
        aria-describedby={longue ? `${id}-mots` : undefined}
        className="input mt-2 min-h-32 w-full resize-y leading-relaxed"
      />
      {longue && (
        <div className="mt-2" id={`${id}-mots`}>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all ${atteint ? "bg-success" : "bg-primary"}`}
              style={{ width: `${avancement}%` }}
            />
          </div>
          <p aria-live="polite" className={`mt-1.5 text-small ${atteint ? "text-success" : "text-content-secondary"}`} data-testid="compteur-mots">
            {mots} {mots > 1 ? "mots" : "mot"} · {atteint ? "minimum atteint" : `au moins ${motsMinimum} mots attendus`}
          </p>
        </div>
      )}
    </div>
  );
}
