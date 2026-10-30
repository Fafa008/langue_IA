"use client";

import { useEffect, useState } from "react";
import { Headphones, Square, Volume2 } from "lucide-react";

interface ListeningAudioProps {
  langue: string;
  audioUrl?: string;
  audioTexte?: string;
}

/** Voix de synthèse par langue ; pour une autre langue, le code seul (« es ») suffit au navigateur. */
const LOCALES: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  zh: "zh-CN",
  it: "it-IT",
  de: "de-DE",
};

export default function ListeningAudio({ langue, audioUrl, audioTexte }: ListeningAudioProps) {
  const [lectureEnCours, setLectureEnCours] = useState(false);
  const [syntheseDisponible, setSyntheseDisponible] = useState(false);

  useEffect(() => {
    setSyntheseDisponible(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const lireTexte = () => {
    if (!syntheseDisponible || !audioTexte) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(audioTexte);
    utterance.lang = LOCALES[langue] ?? langue;
    utterance.rate = 0.9;
    utterance.onstart = () => setLectureEnCours(true);
    utterance.onend = () => setLectureEnCours(false);
    utterance.onerror = () => setLectureEnCours(false);
    window.speechSynthesis.speak(utterance);
  };

  const arreterLecture = () => {
    window.speechSynthesis.cancel();
    setLectureEnCours(false);
  };

  return (
    <div className="my-4 rounded-btn border border-border bg-background p-4">
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <Headphones size={18} aria-hidden="true" className="text-primary" />
        Écoutez l’extrait, puis répondez à la question.
      </p>
      {audioUrl && (
        <audio className="w-full" controls src={audioUrl}>
          Votre navigateur ne permet pas de lire cet audio.
        </audio>
      )}
      {audioTexte && syntheseDisponible && (
        <button
          type="button"
          className="btn-secondary"
          onClick={lectureEnCours ? arreterLecture : lireTexte}
          aria-label={lectureEnCours ? "Arrêter l’écoute" : "Écouter l’extrait"}
        >
          {lectureEnCours
            ? <><Square size={16} aria-hidden="true" /> Arrêter l’écoute</>
            : <><Volume2 size={18} aria-hidden="true" /> Écouter l’extrait</>}
        </button>
      )}
      {audioTexte && !syntheseDisponible && !audioUrl && (
        <p role="status" className="text-small text-content-secondary">
          La lecture audio n’est pas prise en charge par ce navigateur.
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-small text-content-secondary">
        {lectureEnCours ? "Lecture en cours…" : ""}
      </p>
    </div>
  );
}
