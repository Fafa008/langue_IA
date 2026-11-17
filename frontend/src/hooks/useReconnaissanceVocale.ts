"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localeDe } from "@/lib/voix";

/* API Web Speech (Chrome, Edge, Safari) : types minimaux, absents de la bibliothèque DOM de TypeScript. */
interface ResultatReconnaissance {
  readonly length: number;
  [index: number]: { transcript: string };
}
interface EvenementReconnaissance {
  results: { readonly length: number; [index: number]: ResultatReconnaissance };
}
interface Reconnaissance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((evenement: EvenementReconnaissance) => void) | null;
  onerror: ((evenement: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructeurReconnaissance = new () => Reconnaissance;

function constructeur(): ConstructeurReconnaissance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MESSAGES_ERREUR: Record<string, string> = {
  "not-allowed": "Le micro est bloqué : autorisez-le dans votre navigateur, puis réessayez.",
  "service-not-allowed": "Le micro est bloqué : autorisez-le dans votre navigateur, puis réessayez.",
  "no-speech": "Aucune parole détectée. Rapprochez-vous du micro et réessayez.",
  "audio-capture": "Aucun micro n'a été trouvé.",
  network: "La reconnaissance vocale a besoin d'une connexion internet.",
};

/**
 * Reconnaissance vocale du navigateur : transforme la parole en texte dans la langue étudiée.
 * Sans prise en charge (Firefox par exemple), `disponible` est faux et l'écran propose la saisie au clavier.
 */
export function useReconnaissanceVocale(langue: string) {
  const [disponible, setDisponible] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const reconnaissanceRef = useRef<Reconnaissance | null>(null);

  useEffect(() => {
    setDisponible(constructeur() !== null);
    // Le micro est libéré si l'apprenant quitte l'écran pendant l'écoute
    return () => reconnaissanceRef.current?.abort();
  }, []);

  const demarrer = useCallback(() => {
    const Constructeur = constructeur();
    if (!Constructeur) return;
    reconnaissanceRef.current?.abort();
    const reconnaissance = new Constructeur();
    reconnaissance.lang = localeDe(langue);
    reconnaissance.interimResults = true; // le texte s'affiche pendant que l'apprenant parle
    reconnaissance.continuous = false;
    reconnaissance.onresult = (evenement) => {
      let texte = "";
      for (let i = 0; i < evenement.results.length; i++) texte += evenement.results[i][0].transcript;
      setTranscription(texte.trim());
    };
    reconnaissance.onerror = (evenement) => {
      if (evenement.error !== "aborted") setErreur(MESSAGES_ERREUR[evenement.error] ?? "La reconnaissance vocale a échoué. Réessayez.");
      setEcoute(false);
    };
    reconnaissance.onend = () => setEcoute(false);
    reconnaissanceRef.current = reconnaissance;
    setTranscription("");
    setErreur(null);
    setEcoute(true);
    reconnaissance.start();
  }, [langue]);

  const arreter = useCallback(() => reconnaissanceRef.current?.stop(), []);

  return { disponible, ecoute, transcription, setTranscription, erreur, demarrer, arreter };
}
