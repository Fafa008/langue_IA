"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AnalyseEnCoursProps {
  titre: string;
  message: string;
  /** Au-delà, un message rassure l'apprenant : l'analyse est seulement plus longue que d'habitude. */
  delaiLongMs?: number;
  /** compact : dans la carte de la question ; sinon, panneau pleine largeur. */
  compact?: boolean;
}

/** Indicateur de chargement pendant l'analyse par le LLM (réponse libre ou fin du test). */
export default function AnalyseEnCours({ titre, message, delaiLongMs = 8000, compact = false }: AnalyseEnCoursProps) {
  const [long, setLong] = useState(false);

  useEffect(() => {
    const minuteur = setTimeout(() => setLong(true), delaiLongMs);
    return () => clearTimeout(minuteur);
  }, [delaiLongMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="analyse-en-cours"
      className={`flex items-center gap-4 rounded-card border border-primary/20 bg-primary/5 ${compact ? "mt-6 p-4" : "p-6"}`}
    >
      <Loader2 size={compact ? 24 : 32} aria-hidden className="shrink-0 animate-spin text-primary" />
      <div>
        <p className="font-semibold text-content">{titre}</p>
        <p className="mt-0.5 text-small text-content-secondary">
          {long ? "C'est un peu plus long que d'habitude, merci de patienter. Vos réponses sont conservées." : message}
        </p>
      </div>
    </div>
  );
}
