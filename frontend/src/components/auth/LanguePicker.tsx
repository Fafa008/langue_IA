"use client";

import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import FieldGroup from "@/components/ui/FieldGroup";
import { useDismiss } from "@/hooks/useDismiss";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

interface LanguePickerProps {
  value: CodeLangue[];
  onChange: (value: CodeLangue[]) => void;
  error?: string;
}

/** Choix de plusieurs langues dans une liste déroulante avec drapeaux. */
export default function LanguePicker({ value, onChange, error }: LanguePickerProps) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const refs = useRef([conteneur]).current;
  const selection = LANGUES.filter((langue) => value.includes(langue.code));

  useDismiss(
    ouvert,
    refs,
    useCallback(() => setOuvert(false), []),
  );

  const basculerLangue = (code: CodeLangue) => {
    onChange(value.includes(code) ? value.filter((langue) => langue !== code) : [...value, code]);
  };

  return (
    <FieldGroup id="langues" legend="Langues souhaitées" hint="Choisissez au moins une langue." error={error}>
      <div ref={conteneur} className="relative">
        <span id={`${id}-selection`} className="sr-only">
          {selection.length
            ? `Sélection actuelle : ${selection.map((langue) => langue.libelle).join(", ")}`
            : "Aucune langue sélectionnée."}
        </span>
        <button
          ref={bouton}
          type="button"
          aria-label="Choisir les langues souhaitées"
          aria-expanded={ouvert}
          aria-controls={ouvert ? `${id}-liste` : undefined}
          aria-describedby={`${id}-selection langues-message`}
          onClick={() => setOuvert((etat) => !etat)}
          className={`input flex min-h-14 w-full items-center gap-3 py-2 text-left ${error ? "input-error" : ""}`}
        >
          <span aria-hidden className="flex shrink-0 -space-x-2">
            {selection.map((langue) => (
              <Image
                key={langue.code}
                src={langue.flag}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover ring-2 ring-surface"
              />
            ))}
          </span>
          <span className={`min-w-0 flex-1 truncate ${selection.length ? "text-content" : "text-content-secondary"}`}>
            {selection.length ? selection.map((langue) => langue.libelle).join(", ") : "Choisir une ou plusieurs langues"}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 text-primary transition-transform ${ouvert ? "rotate-180" : ""}`}
          />
        </button>

        {ouvert && (
          <div
            id={`${id}-liste`}
            role="group"
            aria-label="Langues disponibles"
            className="absolute z-20 mt-2 w-full rounded-card border border-border bg-surface p-2 shadow-card"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setOuvert(false);
              bouton.current?.focus();
            }}
          >
            {LANGUES.map((langue) => {
              const selectionnee = value.includes(langue.code);
              return (
                <label
                  key={langue.code}
                  className="flex cursor-pointer items-center gap-3 rounded-btn px-3 py-2.5 hover:bg-background"
                >
                  <input
                    type="checkbox"
                    name="langues"
                    value={langue.code}
                    checked={selectionnee}
                    onChange={() => basculerLangue(langue.code)}
                    className="h-4 w-4 accent-primary"
                  />
                  <Image
                    src={langue.flag}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                  />
                  <span className={`flex-1 ${selectionnee ? "font-semibold text-primary" : "text-content"}`}>
                    {langue.libelle}
                  </span>
                  {selectionnee && <Check size={18} aria-hidden className="text-primary" />}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </FieldGroup>
  );
}
