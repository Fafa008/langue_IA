"use client";
import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface SidePanelProps {
  title: string;
  icon?: LucideIcon;
  onClose: () => void;
  /** Empêche la fermeture pendant un envoi. */
  locked?: boolean;
  children: ReactNode;
}

/**
 * Panneau d'édition : sur grand écran, colonne à droite de la liste (qui reste visible) ;
 * sur petit écran, plein écran par-dessus la page. Échap le ferme.
 */
export default function SidePanel({ title, icon: Icon, onClose, locked = false, children }: SidePanelProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Focus sur le premier champ à l'ouverture
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-content/40 lg:sticky lg:inset-auto lg:top-28 lg:z-auto lg:block lg:bg-transparent">
      <section
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        className="h-full w-full max-w-md overflow-y-auto bg-surface shadow-card lg:h-auto lg:max-h-[calc(100vh-8rem)] lg:rounded-card lg:border lg:border-border"
      >
        <header className="flex items-center gap-3 border-b border-border px-6 py-5">
          {Icon && <Icon size={24} className="shrink-0 text-primary" aria-hidden />}
          <h2 id={titleId} className="flex-1 text-h3 text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Fermer le panneau"
            className="rounded-lg p-1.5 text-content-secondary hover:bg-background hover:text-content disabled:opacity-50"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </section>
    </div>
  );
}
