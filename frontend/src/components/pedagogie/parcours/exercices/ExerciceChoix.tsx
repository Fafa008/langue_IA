"use client";

import { useId, useState } from "react";
import ListeningAudio from "@/components/pedagogie/testDiagnostic/ListeningAudio";
import type { ContenuExercice, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonValider from "./BoutonValider";

type Contenu = Extract<ContenuExercice, { format: "choix" | "ecoute" }>;

/** Choix d'une réponse (grammaire, vocabulaire, compréhension) ; pour l'écoute, l'extrait est joué d'abord. */
export default function ExerciceChoix({
  contenu,
  langue,
  enCours,
  onSoumettre,
}: {
  contenu: Contenu;
  langue: string;
  enCours: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
}) {
  const nom = useId();
  const [choix, setChoix] = useState("");
  const question = contenu.format === "ecoute" ? contenu.question : contenu.enonce;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (choix) onSoumettre({ format: contenu.format, reponse: choix });
      }}
    >
      {contenu.format === "ecoute" && (
        // Lecteur du test de positionnement : fichier audio, sinon synthèse vocale ; deux écoutes au plus
        <ListeningAudio langue={langue} audioUrl={contenu.audioUrl ?? undefined} audioTexte={contenu.texteAudio ?? undefined} />
      )}
      <fieldset>
        <legend className="font-medium text-content">{question}</legend>
        <div className="mt-2 space-y-2">
          {contenu.choix.map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-btn border border-border px-3 py-2 hover:bg-background has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name={nom}
                value={option}
                checked={choix === option}
                onChange={() => setChoix(option)}
                className="h-4 w-4 accent-primary"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      <BoutonValider desactive={!choix} enCours={enCours} />
    </form>
  );
}
