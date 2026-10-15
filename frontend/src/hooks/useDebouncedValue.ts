"use client";
import { useEffect, useState } from "react";

/** Valeur mise à jour seulement après `delay` ms sans changement (ex. recherche pendant la frappe). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
