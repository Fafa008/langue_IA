"use client";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import IconInput from "./IconInput";

interface SearchFieldProps {
  /** Nom accessible et texte d'exemple. */
  label: string;
  value: string;
  /** Appelé après une courte pause de frappe (pas à chaque lettre). */
  onSearch: (value: string) => void;
}

export default function SearchField({ label, value, onSearch }: SearchFieldProps) {
  const [saisie, setSaisie] = useState(value);
  const saisieDifferee = useDebouncedValue(saisie);
  /** Dernière recherche appliquée à la liste, qu'elle vienne de ce champ ou de l'URL. */
  const rechercheAppliquee = useRef(value);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Recherche changée hors du champ (lien du menu, bouton Retour) : le champ l'affiche
  useEffect(() => {
    if (value === rechercheAppliquee.current) return;
    rechercheAppliquee.current = value;
    setSaisie(value);
  }, [value]);

  // Pause dans la frappe : la nouvelle recherche est envoyée une seule fois
  useEffect(() => {
    if (saisieDifferee === rechercheAppliquee.current) return;
    rechercheAppliquee.current = saisieDifferee;
    onSearchRef.current(saisieDifferee);
  }, [saisieDifferee]);

  return (
    <IconInput
      icon={Search}
      type="search"
      aria-label={label}
      placeholder={`${label}…`}
      value={saisie}
      onChange={(e) => setSaisie(e.target.value)}
    />
  );
}
