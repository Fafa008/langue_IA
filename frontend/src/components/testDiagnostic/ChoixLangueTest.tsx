"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { LANGUES } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";

interface ChoixLangueTestProps {
  value: CodeLangue;
  onChange: (code: CodeLangue) => void;
  disabled?: boolean;
}

/** « Français » → « francais » : recherche insensible à la casse et aux accents. */
const normaliser = (texte: string) => texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Drapeau({ src, taille }: { src: string; taille: number }) {
  return (
    <Image
      src={src}
      alt=""
      width={taille}
      height={taille}
      style={{ width: taille, height: taille }}
      className="shrink-0 rounded-full object-cover ring-1 ring-border"
    />
  );
}

/** Langue du test : liste déroulante avec drapeaux et recherche, préselectionnée par la page. */
export default function ChoixLangueTest({ value, onChange, disabled = false }: ChoixLangueTestProps) {
  const id = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [active, setActive] = useState(0);

  const selection = LANGUES.find((l) => l.code === value);
  const resultats = LANGUES.filter((l) => normaliser(l.libelle).includes(normaliser(recherche.trim())));

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
    setActive(Math.max(0, LANGUES.findIndex((l) => l.code === value)));
    setOuvert(true);
  };

  const choisir = (code: CodeLangue) => {
    onChange(code);
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
      if (langue) choisir(langue.code);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  };

  return (
    <div ref={conteneur} className="relative">
      <p id={`${id}-label`} className="mb-1.5 block font-medium text-content">
        Langue du test
      </p>
      <button
        type="button"
        data-testid="language-select"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-labelledby={`${id}-label ${id}-valeur`}
        disabled={disabled}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        className="input flex items-center gap-3 pr-10 text-left disabled:cursor-wait disabled:opacity-60"
      >
        {selection && <Drapeau src={selection.flag} taille={24} />}
        <span id={`${id}-valeur`} className="font-semibold text-content">
          {selection?.libelle ?? "Choisissez une langue"}
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

          <ul id={`${id}-liste`} role="listbox" aria-label="Langues disponibles" className="mt-2 max-h-64 overflow-y-auto">
            {resultats.map(({ code, libelle, flag }, index) => {
              const selectionnee = code === value;
              return (
                <li
                  key={code}
                  id={`${id}-${code}`}
                  role="option"
                  aria-selected={selectionnee}
                  data-testid={`language-option-${code}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choisir(code)}
                  className={`flex cursor-pointer items-center gap-3 rounded-btn px-3 py-2.5 ${
                    index === active ? "bg-background" : ""
                  }`}
                >
                  <Drapeau src={flag} taille={28} />
                  <span className={`flex-1 ${selectionnee ? "font-semibold text-primary" : "text-content"}`}>{libelle}</span>
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
