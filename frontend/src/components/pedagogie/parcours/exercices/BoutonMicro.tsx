"use client";

import { Mic, Square } from "lucide-react";

/** Bouton de dictée : démarre ou arrête la reconnaissance vocale ; l'état est annoncé en texte. */
export default function BoutonMicro({
  ecoute,
  onDemarrer,
  onArreter,
  disabled = false,
  libelle = "Parler",
}: {
  ecoute: boolean;
  onDemarrer: () => void;
  onArreter: () => void;
  disabled?: boolean;
  libelle?: string;
}) {
  return (
    <button
      type="button"
      onClick={ecoute ? onArreter : onDemarrer}
      disabled={disabled}
      aria-pressed={ecoute}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold transition-colors disabled:opacity-50 ${
        ecoute ? "bg-error text-white hover:bg-error/90" : "bg-primary text-white hover:bg-primary-dark"
      }`}
    >
      {ecoute ? <Square size={16} aria-hidden /> : <Mic size={18} aria-hidden />}
      {ecoute ? "Arrêter" : libelle}
      {ecoute && <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-white" />}
    </button>
  );
}
