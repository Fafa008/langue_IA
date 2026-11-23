interface TexteATrousProps {
  id: string;
  /** Jetons proposés dans le désordre (lettres ou idéogrammes). */
  lettres: string[];
  valeur: string;
  onChange: (texte: string) => void;
  disabled?: boolean;
}

/** Exercice d'écriture : reconstruire le mot manquant à partir des jetons mélangés. */
export default function TexteATrous({ id, lettres, valeur, onChange, disabled = false }: TexteATrousProps) {
  return (
    <div className="mt-4" data-testid="texte-a-trous">
      <p className="font-semibold text-content" id={`lettres-${id}`}>Lettres disponibles</p>
      <div className="mt-2 flex flex-wrap gap-2" aria-labelledby={`lettres-${id}`}>
        {lettres.map((lettre, index) => (
          <span
            key={`${id}-${index}`}
            className="flex h-10 w-10 items-center justify-center rounded-btn border border-border bg-background font-semibold text-content"
          >
            {lettre}
          </span>
        ))}
      </div>
      <label className="mt-4 block font-semibold text-content" htmlFor={id}>Votre réponse</label>
      <input
        id={id}
        type="text"
        value={valeur}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete="off"
        className="mt-2 w-full rounded-btn border border-border bg-surface px-4 py-3 text-content"
      />
    </div>
  );
}
