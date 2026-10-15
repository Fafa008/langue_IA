"use client";
import { useEffect, type RefObject } from "react";

/** Ferme un élément ouvert (menu…) au clic en dehors des `refs` ou avec la touche Échap. */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!refs.some((ref) => ref.current?.contains(e.target as Node))) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refs, onDismiss]);
}
