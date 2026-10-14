"use client";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

const AUTO_CLOSE_MS = 5000;

interface ToastProps {
  children: ReactNode;
  onClose: () => void;
}

/** Confirmation affichée en haut à droite, fermée automatiquement après quelques secondes. */
export default function Toast({ children, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [children, onClose]);

  return (
    <div
      role="status"
      className="fixed right-4 top-24 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-btn border border-success/40 bg-[#F0FAF3] px-4 py-3.5 font-medium text-content shadow-card sm:right-8"
    >
      <CheckCircle2 size={22} className="shrink-0 fill-success text-white" aria-hidden />
      <span>{children}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la notification"
        className="ml-4 rounded p-0.5 text-content-secondary hover:text-content"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
