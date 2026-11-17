"use client";

import { Bot } from "lucide-react";
import { useId, useState } from "react";
import type { ContenuExercice, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonValider from "./BoutonValider";

export const compterMots = (texte: string) => texte.trim().split(/\s+/).filter(Boolean).length;

/**
 * US43 — Réponse libre (sans audio) : l'apprenant rédige quelques phrases, le professeur IA les corrige.
 * Le texte reste dans la zone après l'envoi, pour être retravaillé si la correction le demande.
 */
export default function ExerciceRedaction({
  contenu,
  langue,
  enCours,
  verrouille,
  onSoumettre,
}: {
  contenu: Extract<ContenuExercice, { format: "redaction" }>;
  langue: string;
  enCours: boolean;
  verrouille: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
}) {
  const id = useId();
  const [texte, setTexte] = useState("");
  const mots = compterMots(texte);
  const assez = mots >= contenu.motsMinimum;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (mots > 0) onSoumettre({ format: "redaction", reponse: texte.trim() });
      }}
    >
      <label htmlFor={`${id}-texte`} className="font-medium text-content">
        {contenu.enonce}
      </label>
      <textarea
        id={`${id}-texte`}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={5}
        lang={langue}
        maxLength={2000}
        readOnly={verrouille || enCours}
        aria-describedby={`${id}-compteur`}
        className="input mt-2 resize-y"
      />
      <p id={`${id}-compteur`} className={`mt-1 text-small ${assez ? "text-success-dark" : "text-content-secondary"}`}>
        {mots} mot{mots > 1 ? "s" : ""} · {contenu.motsMinimum} conseillés
      </p>
      {enCours && (
        <p role="status" className="mt-3 flex items-center gap-2 text-small text-content-secondary">
          <Bot size={16} className="animate-pulse text-primary" aria-hidden /> Le professeur IA corrige votre texte… cela peut prendre quelques secondes.
        </p>
      )}
      {!verrouille && <BoutonValider desactive={mots === 0} enCours={enCours} libelle="Envoyer au professeur IA" />}
    </form>
  );
}
