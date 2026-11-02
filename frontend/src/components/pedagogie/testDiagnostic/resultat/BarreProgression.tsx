/** Barre de progression d'un score, en pourcentage. */
export default function BarreProgression({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valeur}
      className="h-2 overflow-hidden rounded-full bg-border"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${valeur}%` }} />
    </div>
  );
}
