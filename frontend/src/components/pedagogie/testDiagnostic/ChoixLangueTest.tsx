"use client";

import Image from "next/image";
import { useId } from "react";
import { drapeauLangue } from "@/lib/languages";
import { descriptionEchelle } from "@/lib/referentiels";
import type { LangueDiagnostic } from "@/types/test-diagnostic";

interface ChoixLangueTestProps {
  langues: LangueDiagnostic[];
  /** Code de la langue choisie, null tant qu'aucune ne l'est. */
  value: string | null;
  onChange: (code: string) => void;
  /** Id du titre qui nomme la liste. */
  labelledBy: string;
  disabled?: boolean;
}

/** Drapeau de la langue, ou son code pour une langue sans drapeau. */
function Pastille({ code, taille }: { code: string; taille: number }) {
  const drapeau = drapeauLangue(code);
  if (drapeau) {
    return (
      <Image
        src={drapeau}
        alt=""
        width={taille}
        height={taille}
        unoptimized
        style={{ width: taille, height: taille }}
        className="shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: taille, height: taille }}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.625rem] font-bold uppercase text-primary"
    >
      {code}
    </span>
  );
}

const sousTitre = (langue: LangueDiagnostic) =>
  langue.disponible ? descriptionEchelle(langue.cadre, langue.niveaux) : "Bientôt disponible";

/** Affiche la langue unique ou les langues de choix avec leur drapeau. */
export default function ChoixLangueTest({ langues, value, onChange, labelledBy, disabled = false }: ChoixLangueTestProps) {
  const id = useId();
  const choixMultiple = langues.length > 1;

  return (
    <fieldset aria-labelledby={labelledBy} disabled={disabled} className="space-y-2">
      {langues.length === 0 ? (
        <p className="text-content-secondary">Aucune langue n&apos;est associée à votre inscription.</p>
      ) : (
        langues.map((langue) => {
          const optionId = `${id}-${langue.code}`;
          const contenu = (
            <>
              {choixMultiple && (
                <input
                  id={optionId}
                  type="radio"
                  name={`${id}-langue-test`}
                  value={langue.code}
                  checked={value === langue.code}
                  disabled={!langue.disponible}
                  onChange={() => onChange(langue.code)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
              )}
              <Pastille code={langue.code} taille={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={value === langue.code ? "font-semibold text-primary" : "font-semibold text-content"}>
                  {langue.libelle}
                </span>
                <span className={`text-small ${value === langue.code ? "text-content" : "text-content-secondary"}`}>
                  {sousTitre(langue)}
                </span>
              </span>
            </>
          );
          const className = `flex min-h-16 items-center gap-3 rounded-btn border p-3 ${
            !langue.disponible ? "opacity-60" : choixMultiple ? "cursor-pointer" : ""
          } ${value === langue.code ? "border-primary bg-primary/5" : "border-border bg-surface"}`;

          return choixMultiple ? (
            <label
              key={langue.code}
              htmlFor={optionId}
              className={className}
            >
              {contenu}
            </label>
          ) : (
            <div key={langue.code} className={className}>
              {contenu}
            </div>
          );
        })
      )}
    </fieldset>
  );
}
