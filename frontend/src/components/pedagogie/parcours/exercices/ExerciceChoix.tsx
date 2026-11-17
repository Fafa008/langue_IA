"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useId, useState } from "react";
import ListeningAudio from "@/components/pedagogie/testDiagnostic/ListeningAudio";
import type { ContenuExercice, CorrectionExercice, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonValider from "./BoutonValider";

type Contenu = Extract<ContenuExercice, { format: "choix" | "ecoute" }>;

/**
 * US43 — QCM (grammaire, vocabulaire, compréhension ; pour l'écoute, l'extrait est joué d'abord).
 * Après la correction automatique, les choix sont figés : la réponse donnée et la bonne réponse sont signalées.
 */
export default function ExerciceChoix({
  contenu,
  langue,
  enCours,
  correction,
  onSoumettre,
}: {
  contenu: Contenu;
  langue: string;
  enCours: boolean;
  /** Correction reçue ; tant qu'elle est affichée, la réponse ne peut pas être changée. */
  correction: CorrectionExercice | null;
  onSoumettre: (reponse: ReponseExercice) => void;
}) {
  const nom = useId();
  const [choix, setChoix] = useState("");
  const question = contenu.format === "ecoute" ? contenu.question : contenu.enonce;
  const bonneReponse = correction ? (correction.reponseAttendue ?? (correction.statut === "REUSSI" ? choix : null)) : null;

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
      <fieldset disabled={Boolean(correction) || enCours}>
        <legend className="font-medium text-content">{question}</legend>
        <div className="mt-2 space-y-2">
          {contenu.choix.map((option) => {
            const donnee = correction !== null && option === choix;
            const bonne = option === bonneReponse;
            const style = bonne
              ? "border-success bg-success/10"
              : donnee
                ? "border-error bg-error/5"
                : "border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5";
            return (
              <label
                key={option}
                className={`flex min-h-11 items-center gap-3 rounded-btn border px-3 py-2 ${style} ${correction ? "" : "cursor-pointer hover:bg-background"}`}
              >
                <input
                  type="radio"
                  name={nom}
                  value={option}
                  checked={choix === option}
                  onChange={() => setChoix(option)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="flex-1">{option}</span>
                {bonne && (
                  <span className="inline-flex items-center gap-1 text-small font-semibold text-success-dark">
                    <CheckCircle2 size={16} aria-hidden /> {donnee ? "Votre réponse, juste" : "Bonne réponse"}
                  </span>
                )}
                {donnee && !bonne && (
                  <span className="inline-flex items-center gap-1 text-small font-semibold text-error-dark">
                    <XCircle size={16} aria-hidden /> Votre réponse
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
      {!correction && <BoutonValider desactive={!choix} enCours={enCours} />}
    </form>
  );
}
