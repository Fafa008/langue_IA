"use client";

import { Mic, Square } from "lucide-react";

/** Démarre ou arrête la reconnaissance vocale, avec un nom accessible même en présentation compacte. */
export default function BoutonMicro({
  ecoute,
  onDemarrer,
  onArreter,
  disabled = false,
  libelle = "Parler",
  libelleArreter = "Arrêter",
  iconeSeule = false,
}: {
  ecoute: boolean;
  onDemarrer: () => void;
  onArreter: () => void;
  disabled?: boolean;
  libelle?: string;
  libelleArreter?: string;
  iconeSeule?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => (ecoute ? onArreter() : onDemarrer())}
      disabled={disabled}
      aria-pressed={ecoute}
      aria-label={ecoute ? libelleArreter : libelle}
      title={ecoute ? libelleArreter : libelle}
      className={`inline-flex min-h-11 items-center rounded-full font-semibold transition-colors disabled:opacity-50 ${
        iconeSeule ? "w-11 justify-center px-0" : "gap-2 px-4"
      } ${
        ecoute ? "bg-error text-white hover:bg-error/90" : "bg-primary text-white hover:bg-primary-dark"
      }`}
    >
      {ecoute ? <Square size={16} aria-hidden /> : <Mic size={18} aria-hidden />}
      {!iconeSeule && (ecoute ? libelleArreter : libelle)}
      {ecoute && <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-white" />}
    </button>
  );
}
