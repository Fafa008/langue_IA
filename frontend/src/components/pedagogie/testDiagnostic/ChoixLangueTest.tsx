"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { drapeauLangue } from "@/lib/languages";
import { descriptionEchelle } from "@/lib/referentiels";
import type { LangueDiagnostic } from "@/types/test-diagnostic";

interface ChoixLangueTestProps {
  langues: LangueDiagnostic[];
  /** Code de la langue choisie, null tant qu'aucune ne l'est. */
  value: string | null;
  onChange: (code: string) => void;
  /** Id du titre qui nomme la liste (« 1. Choisissez la langue »). */
  labelledBy: string;
  disabled?: boolean;
}

/** « Français » → « francais » : recherche insensible à la casse et aux accents. */
const normaliser = (texte: string) => texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Drapeau de la langue, ou son code (« ES ») pour une langue sans drapeau. */
function Pastille({ code, taille }: { code: string; taille: number }) {
  const drapeau = drapeauLangue(code);
  if (drapeau) {
    return (
      <Image
        src={drapeau}
        alt=""
        width={taille}
        height={taille}
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

/**
 * Langue du test : liste déroulante avec drapeaux, échelle et recherche.
 * Une langue sans question est affichée « Bientôt disponible » et ne peut pas être choisie.
 */
export default function ChoixLangueTest({ langues, value, onChange, labelledBy, disabled = false }: ChoixLangueTestProps) {
  const id = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [active, setActive] = useState(0);

  const selection = langues.find((l) => l.code === value);
  const resultats = langues.filter((l) => normaliser(l.libelle).includes(normaliser(recherche.trim())));

  useEffect(() => {
    if (!ouvert) return;
    champRecherche.current?.focus();
    const fermerSiExterieur = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermerSiExterieur);
    return () => document.removeEventListener("mousedown", fermerSiExterieur);
  }, [ouvert]);

  const ouvrir = () => {
    setRecherche("");
    setActive(Math.max(0, langues.findIndex((l) => l.code === value)));
    setOuvert(true);
  };

  const choisir = (langue: LangueDiagnostic) => {
    if (!langue.disponible) return;
    onChange(langue.code);
    setOuvert(false);
  };

  const naviguer = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (resultats.length === 0) return;
      const pas = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + pas + resultats.length) % resultats.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const langue = resultats[active];
      if (langue) choisir(langue);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  };

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        data-testid="language-select"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-labelledby={`${labelledBy} ${id}-valeur`}
        disabled={disabled}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        className="input flex h-auto min-h-[3.5rem] items-center gap-3 py-2 pr-10 text-left disabled:cursor-wait disabled:opacity-60"
      >
        {selection && <Pastille code={selection.code} taille={28} />}
        <span id={`${id}-valeur`} className="flex flex-col">
          <span className={selection ? "font-semibold text-content" : "text-content-secondary"}>
            {selection?.libelle ?? "Choisissez une langue"}
          </span>
          {selection && <span className="text-small text-content-secondary">{sousTitre(selection)}</span>}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`pointer-events-none absolute right-3 text-primary transition-transform ${ouvert ? "rotate-180" : ""}`}
        />
      </button>

      {ouvert && (
        <div className="absolute z-20 mt-2 w-full rounded-card border border-border bg-surface p-2 shadow-card">
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute inset-y-0 left-3 my-auto text-content-secondary" />
            <input
              ref={champRecherche}
              type="search"
              role="combobox"
              aria-label="Rechercher une langue"
              aria-expanded
              aria-controls={`${id}-liste`}
              aria-activedescendant={resultats[active] ? `${id}-${resultats[active].code}` : undefined}
              placeholder="Rechercher une langue…"
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setActive(0);
              }}
              onKeyDown={naviguer}
              className="input pl-9"
            />
          </div>

          <ul id={`${id}-liste`} role="listbox" aria-label="Langues proposées" className="mt-2 max-h-72 overflow-y-auto">
            {resultats.map((langue, index) => {
              const selectionnee = langue.code === value;
              return (
                <li
                  key={langue.code}
                  id={`${id}-${langue.code}`}
                  role="option"
                  aria-selected={selectionnee}
                  aria-disabled={!langue.disponible}
                  data-testid={`language-option-${langue.code}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choisir(langue)}
                  className={`flex items-center gap-3 rounded-btn px-3 py-2.5 ${
                    langue.disponible ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                  } ${index === active ? "bg-background" : ""}`}
                >
                  <Pastille code={langue.code} taille={28} />
                  <span className="flex flex-1 flex-col">
                    <span className={selectionnee ? "font-semibold text-primary" : "text-content"}>{langue.libelle}</span>
                    <span className="text-small text-content-secondary">{sousTitre(langue)}</span>
                  </span>
                  {selectionnee && <Check size={18} aria-hidden className="text-primary" />}
                </li>
              );
            })}
            {resultats.length === 0 && (
              <li className="px-3 py-2.5 text-content-secondary">Aucune langue ne correspond à « {recherche} ».</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
