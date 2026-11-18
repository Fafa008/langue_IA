"use client";

import { useState } from "react";
import type { ContenuExercice, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonValider from "./BoutonValider";

/** Marque du trou dans l'énoncé d'une phrase à compléter. */
export const TROU = "___";

/** US43 — Phrase à compléter (« ___ »), corrigée automatiquement ; figée tant que la correction est affichée. */
export default function ExerciceTexte({
  contenu,
  enCours,
  verrouille,
  onSoumettre,
}: {
  contenu: Extract<ContenuExercice, { format: "texte" }>;
  enCours: boolean;
  /** Vrai tant que la correction est affichée. */
  verrouille: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
}) {
  const [texte, setTexte] = useState("");
  const [avant, apres] = contenu.enonce.includes(TROU) ? contenu.enonce.split(TROU) : [contenu.enonce, null];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (texte.trim()) onSoumettre({ format: "texte", reponse: texte.trim() });
      }}
    >
      {apres === null ? (
        <label className="block">
          <span className="font-medium text-content">{avant}</span>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} readOnly={verrouille} className="input mt-2" />
        </label>
      ) : (
        <p className="flex flex-wrap items-center gap-2 font-medium text-content">
          {avant && <span>{avant}</span>}
          <input
            type="text"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            aria-label="Votre réponse"
            placeholder="Votre réponse…"
            autoComplete="off"
            readOnly={verrouille || enCours}
            className="input w-44 px-3 py-2"
          />
          {apres && <span>{apres}</span>}
        </p>
      )}
      {!verrouille && <BoutonValider desactive={!texte.trim()} enCours={enCours} />}
    </form>
  );
}
