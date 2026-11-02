"use client";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismiss } from "@/hooks/useDismiss";
import { LANGUES } from "@/lib/languages";
import { usePreferencesStore } from "@/store/preferences.store";

/** Choix de la langue d'affichage (à gauche du menu du compte), avec le drapeau de chaque langue. */
export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const langue = usePreferencesStore((s) => s.langueInterface);
  const setLangue = usePreferencesStore((s) => s.setLangueInterface);
  const courante = LANGUES.find((l) => l.code === langue) ?? LANGUES[0];

  const refs = useRef([ref]).current;
  useDismiss(open, refs, useCallback(() => setOpen(false), []));

  useEffect(() => {
    usePreferencesStore.persist.rehydrate();
  }, []);

  // Les lecteurs d'écran et le navigateur (traduction, césure) suivent la langue choisie
  useEffect(() => {
    document.documentElement.lang = courante.code;
  }, [courante.code]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Langue d'affichage : ${courante.natif}`}
        className="flex items-center gap-2 rounded-full p-1.5 pr-2 transition-colors hover:bg-background"
      >
        <Image src={courante.flag} alt="" width={28} height={28} loading="eager" className="h-7 w-7 rounded-full object-cover ring-1 ring-border" />
        <span className="hidden text-small font-semibold uppercase text-content sm:inline">{courante.code}</span>
        <ChevronDown size={16} className={`text-content transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div role="menu" aria-label="Langue d'affichage" className="absolute right-0 mt-2 w-52 rounded-btn border border-border bg-surface py-2 shadow-card">
          {LANGUES.map(({ code, natif, flag }) => {
            const active = code === courante.code;
            return (
              <button
                key={code}
                role="menuitemradio"
                aria-checked={active}
                type="button"
                lang={code}
                onClick={() => {
                  setLangue(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 hover:bg-background ${
                  active ? "font-semibold text-primary" : "text-content hover:text-primary"
                }`}
              >
                <Image src={flag} alt="" width={24} height={24} loading="eager" className="h-6 w-6 rounded-full object-cover ring-1 ring-border" />
                <span className="flex-1 text-left">{natif}</span>
                {active && <Check size={16} aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
