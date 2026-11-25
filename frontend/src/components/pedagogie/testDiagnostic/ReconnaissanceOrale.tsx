"use client";

import { useRef, useState } from "react";
import { Mic, RotateCcw, Square } from "lucide-react";
import { useReconnaissanceVocale } from "@/hooks/useReconnaissanceVocale";
import RedactionEcrite from "./RedactionEcrite";

interface ReconnaissanceOraleProps {
  langue: string;
  valeur: string;
  dureeMinimale: number;
  onChange: (texte: string) => void;
  disabled?: boolean;
}

/** Expression orale : envoie uniquement la transcription du navigateur, sans conserver l'audio. */
export default function ReconnaissanceOrale({
  langue,
  valeur,
  dureeMinimale,
  onChange,
  disabled = false,
}: ReconnaissanceOraleProps) {
  const voix = useReconnaissanceVocale(langue);
  const debutRef = useRef<number | null>(null);
  const abandonneeRef = useRef(false);
  const [erreurDuree, setErreurDuree] = useState<string | null>(null);

  const commencer = () => {
    if (!voix.disponible) return;
    abandonneeRef.current = false;
    debutRef.current = Date.now();
    setErreurDuree(null);
    onChange("");
    voix.demarrer((transcription) => {
      if (abandonneeRef.current || !transcription.trim() || debutRef.current === null) return;
      const duree = (Date.now() - debutRef.current) / 1000;
      if (duree < dureeMinimale) {
        setErreurDuree(`Parlez au moins ${dureeMinimale} secondes, puis recommencez.`);
        return;
      }
      onChange(transcription);
    });
  };

  const arreter = () => voix.arreter();

  const recommencer = () => {
    abandonneeRef.current = true;
    if (voix.ecoute) voix.arreter();
    debutRef.current = null;
    setErreurDuree(null);
    onChange("");
    commencer();
  };

  if (!voix.disponible) {
    return (
      <div className="mt-4">
        <p role="status" className="mb-3 rounded-btn bg-background p-4 text-small text-content-secondary">
          La reconnaissance vocale n&apos;est pas prise en charge par ce navigateur. Vous pouvez saisir votre réponse.
        </p>
        <RedactionEcrite
          id={`reponse-orale-${langue}`}
          valeur={valeur}
          onChange={onChange}
          motsMinimum={1}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center" data-testid="reconnaissance-orale">
      <button
        type="button"
        onClick={voix.ecoute ? arreter : valeur ? recommencer : commencer}
        disabled={disabled}
        aria-label={voix.ecoute ? "Arrêter la reconnaissance vocale" : valeur ? "Recommencer la réponse orale" : "Commencer la réponse orale"}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-card transition-transform hover:scale-105 disabled:opacity-50"
      >
        {voix.ecoute ? <Square size={24} aria-hidden /> : valeur ? <RotateCcw size={26} aria-hidden /> : <Mic size={28} aria-hidden />}
      </button>
      <p role="status" aria-live="polite" className="mt-3 text-center text-small text-content-secondary">
        {voix.ecoute ? "Parlez maintenant, puis arrêtez le micro." : valeur ? "Transcription prête." : "Appuyez sur le micro et répétez la phrase."}
      </p>
      <p className="mt-1 text-center text-xs text-content-secondary">
        Seule la transcription est envoyée ; aucun enregistrement audio n&apos;est conservé.
      </p>
      {voix.transcription && (
        <p lang={langue} className="mt-3 w-full rounded-btn border border-border p-3 font-medium text-content" data-testid="transcription-orale">
          {voix.transcription}
        </p>
      )}
      {voix.erreur && <p role="alert" className="mt-3 text-center text-small text-error">{voix.erreur}</p>}
      {erreurDuree && <p role="alert" className="mt-3 text-center text-small text-error">{erreurDuree}</p>}
    </div>
  );
}
