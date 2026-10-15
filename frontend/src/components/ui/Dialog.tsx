"use client";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Empêche la fermeture pendant un envoi. */
  locked?: boolean;
}

/**
 * Fenêtre modale basée sur <dialog> : le navigateur gère le focus, la touche Échap
 * et rend le reste de la page inerte. Affichée dès le montage du composant.
 */
export default function Dialog({ title, description, onClose, children, locked = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Échap : le navigateur annule le dialog ; on décide nous-mêmes de le fermer
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      // Clic sur le fond assombri (en dehors de la boîte)
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-card border border-border bg-surface p-0 text-content shadow-card backdrop:bg-content/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-h3 text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Fermer"
            className="-mr-2 -mt-1 rounded-lg p-1.5 text-content-secondary hover:bg-background hover:text-content disabled:opacity-50"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-1 text-content-secondary">
            {description}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
