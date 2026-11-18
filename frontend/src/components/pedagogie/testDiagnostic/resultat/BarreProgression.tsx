/** Barre de progression d'un score, en pourcentage ; `valeurTexte` remplace « 40 % » pour les lecteurs d'écran. */
export default function BarreProgression({ label, valeur, valeurTexte }: { label: string; valeur: number; valeurTexte?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valeur}
      aria-valuetext={valeurTexte}
      className="h-2 overflow-hidden rounded-full bg-border"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${valeur}%` }} />
    </div>
  );
}
