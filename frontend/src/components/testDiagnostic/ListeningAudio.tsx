"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Square } from "lucide-react";

interface ListeningAudioProps {
  langue: string;
  /** Fichier audio servi par le backend (production). */
  audioUrl?: string;
  /** Texte lu par la synthèse vocale du navigateur, à défaut de fichier (démonstration). */
  audioTexte?: string;
}

/** Comme à l'examen, l'extrait ne peut être écouté que deux fois. */
export const ECOUTES_MAX = 2;

/** Voix de synthèse par langue ; pour une autre langue, le code seul (« es ») suffit au navigateur. */
const LOCALES: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  zh: "zh-CN",
  it: "it-IT",
  de: "de-DE",
};

/** Compréhension orale : un bouton unique lit l'extrait (fichier audio ou synthèse vocale), deux fois au plus. */
export default function ListeningAudio({ langue, audioUrl, audioTexte }: ListeningAudioProps) {
  const [lectureEnCours, setLectureEnCours] = useState(false);
  const [ecoutes, setEcoutes] = useState(0);
  const [syntheseDisponible, setSyntheseDisponible] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setSyntheseDisponible("speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const lisible = Boolean(audioUrl) || (Boolean(audioTexte) && syntheseDisponible);
  const restantes = ECOUTES_MAX - ecoutes;

  const ecouter = () => {
    if (restantes <= 0) return;
    setEcoutes((n) => n + 1);
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
      return;
    }
    if (!audioTexte) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(audioTexte);
    utterance.lang = LOCALES[langue] ?? langue;
    utterance.rate = 0.9;
    utterance.onstart = () => setLectureEnCours(true);
    utterance.onend = () => setLectureEnCours(false);
    utterance.onerror = () => setLectureEnCours(false);
    window.speechSynthesis.speak(utterance);
  };

  const arreter = () => {
    audioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setLectureEnCours(false);
  };

  if (!lisible) {
    return (
      <p role="status" className="my-4 rounded-btn bg-background p-4 text-small text-content-secondary">
        La lecture audio n’est pas prise en charge par ce navigateur.
      </p>
    );
  }

  return (
    <div className="my-6 flex flex-col items-center" data-testid="ecoute">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onPlay={() => setLectureEnCours(true)}
          onPause={() => setLectureEnCours(false)}
          onEnded={() => setLectureEnCours(false)}
        />
      )}
      <div className="relative flex h-32 w-32 items-center justify-center">
        {lectureEnCours && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/10" />}
        <span aria-hidden className="absolute inset-3 rounded-full bg-primary/10" />
        <button
          type="button"
          onClick={lectureEnCours ? arreter : ecouter}
          disabled={!lectureEnCours && restantes <= 0}
          aria-label={lectureEnCours ? "Arrêter l’écoute" : "Écouter l’extrait"}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-card transition-transform hover:scale-105 disabled:bg-border disabled:text-content-secondary"
        >
          {lectureEnCours ? <Square size={28} aria-hidden /> : <Headphones size={34} aria-hidden />}
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-center text-small text-content-secondary">
        {lectureEnCours
          ? "Lecture en cours…"
          : restantes > 0
            ? `Écoutes restantes : ${restantes} sur ${ECOUTES_MAX}`
            : `Vous avez utilisé vos ${ECOUTES_MAX} écoutes.`}
      </p>
    </div>
  );
}
