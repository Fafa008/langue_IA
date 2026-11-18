"use client";

import { Volume2 } from "lucide-react";
import { useReconnaissanceVocale } from "@/hooks/useReconnaissanceVocale";
import { lireAVoixHaute, syntheseDisponible } from "@/lib/voix";
import type { ContenuExercice, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonMicro from "./BoutonMicro";
import BoutonValider from "./BoutonValider";

/**
 * Oral : l'apprenant lit la phrase à voix haute ; la reconnaissance vocale la transcrit, la transcription est corrigée.
 * La transcription n'est pas modifiable ; sans reconnaissance vocale, l'apprenant écrit la phrase (c'est indiqué).
 */
export default function ExercicePrononciation({
  contenu,
  langue,
  enCours,
  verrouille,
  onSoumettre,
}: {
  contenu: Extract<ContenuExercice, { format: "prononciation" }>;
  langue: string;
  enCours: boolean;
  verrouille: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
}) {
  const voix = useReconnaissanceVocale(langue);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (voix.transcription) onSoumettre({ format: "prononciation", reponse: voix.transcription });
      }}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-card bg-primary/5 p-4">
        <p lang={langue} className="flex-1 text-h4 font-semibold text-primary">
          « {contenu.phrase} »
        </p>
        {syntheseDisponible() && (
          <button
            type="button"
            onClick={() => lireAVoixHaute(contenu.phrase, langue)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-small font-semibold text-primary hover:bg-background"
          >
            <Volume2 size={16} aria-hidden /> Écouter le modèle
          </button>
        )}
      </div>

      {voix.disponible ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BoutonMicro ecoute={voix.ecoute} onDemarrer={voix.demarrer} onArreter={voix.arreter} disabled={enCours} libelle="Lire à voix haute" />
          <p role="status" aria-live="polite" className="text-small text-content-secondary">
            {voix.ecoute ? "Je vous écoute…" : voix.transcription ? "Voici ce que nous avons compris :" : "Appuyez, lisez la phrase, puis arrêtez."}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-btn bg-background p-3 text-small text-content-secondary">
          La reconnaissance vocale n&apos;est pas disponible sur ce navigateur (essayez Chrome ou Edge). Vous pouvez écrire la phrase à la place.
        </p>
      )}
      {voix.erreur && <p role="alert" className="msg-error mt-2">{voix.erreur}</p>}

      {voix.disponible ? (
        voix.transcription && (
          <p lang={langue} className="mt-3 rounded-btn border border-border p-3 font-medium text-content" data-testid="transcription">
            {voix.transcription}
          </p>
        )
      ) : (
        <label className="mt-3 block">
          <span className="text-small font-medium text-content-secondary">Votre phrase</span>
          <input
            type="text"
            value={voix.transcription}
            onChange={(e) => voix.setTranscription(e.target.value)}
            className="input mt-1"
            lang={langue}
          />
        </label>
      )}
      {!verrouille && <BoutonValider desactive={!voix.transcription || voix.ecoute} enCours={enCours} />}
    </form>
  );
}
