"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, RotateCcw, Square } from "lucide-react";
import { formaterDuree } from "@/lib/etapesTest";

interface EnregistrementOralProps {
  /** Enregistrement retenu (assez long), null sinon. */
  audio: Blob | null;
  /** Durée de parole minimale, en secondes. */
  dureeMinimale: number;
  /** Appelé avec l'enregistrement s'il est assez long, avec null quand il est effacé. */
  onChange: (audio: Blob | null) => void;
  disabled?: boolean;
}

type Etat = "pret" | "enregistrement" | "termine";

/** Bouton rond avec son libellé dessous (Stop, Recommencer). */
function Action({ libelle, onClick, children }: { libelle: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 text-small font-medium text-content">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-card transition-colors hover:bg-background">
        {children}
      </span>
      {libelle}
    </button>
  );
}

/**
 * Expression orale : enregistrement au micro avec chronomètre, arrêt, nouvel essai et réécoute.
 * Un enregistrement plus court que `dureeMinimale` n'est pas retenu.
 */
export default function EnregistrementOral({ audio, dureeMinimale, onChange, disabled = false }: EnregistrementOralProps) {
  const [etat, setEtat] = useState<Etat>(audio ? "termine" : "pret");
  const [secondes, setSecondes] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [urlAudio, setUrlAudio] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const debutRef = useRef(0);

  // Chronomètre pendant l'enregistrement
  useEffect(() => {
    if (etat !== "enregistrement") return;
    const minuteur = setInterval(() => setSecondes((Date.now() - debutRef.current) / 1000), 250);
    return () => clearInterval(minuteur);
  }, [etat]);

  // Lecteur de réécoute
  useEffect(() => {
    if (!audio) {
      setUrlAudio(null);
      return;
    }
    const url = URL.createObjectURL(audio);
    setUrlAudio(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  // Le micro est libéré si l'apprenant quitte la question en cours d'enregistrement
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const commencer = async () => {
    setErreur(null);
    onChange(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErreur("L’enregistrement audio n’est pas pris en charge par ce navigateur.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const morceaux: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) morceaux.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const duree = (Date.now() - debutRef.current) / 1000;
        setSecondes(duree);
        setEtat("termine");
        if (duree < dureeMinimale) {
          setErreur(`Votre enregistrement dure ${Math.floor(duree)} s : parlez au moins ${dureeMinimale} secondes, puis recommencez.`);
          return;
        }
        onChange(new Blob(morceaux, { type: recorder.mimeType || "audio/webm" }));
      };
      recorderRef.current = recorder;
      debutRef.current = Date.now();
      setSecondes(0);
      recorder.start();
      setEtat("enregistrement");
    } catch {
      setErreur("Impossible d’accéder au microphone. Autorisez-le dans votre navigateur, puis réessayez.");
    }
  };

  const arreter = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const recommencer = () => {
    if (recorderRef.current?.state === "recording") {
      // L'enregistrement en cours est abandonné : il ne doit pas être retenu à l'arrêt
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
    onChange(null);
    setErreur(null);
    setSecondes(0);
    setEtat("pret");
  };

  const enCours = etat === "enregistrement";
  const statut = enCours
    ? `Enregistrement en cours… ${formaterDuree(secondes)}`
    : audio
      ? `Enregistrement prêt (${formaterDuree(secondes)})`
      : `Appuyez sur le micro et parlez au moins ${dureeMinimale} secondes.`;

  return (
    <div className="mt-6 flex flex-col items-center" data-testid="enregistrement-oral">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {enCours && (
          <>
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
            <span aria-hidden className="absolute inset-4 rounded-full bg-primary/15" />
          </>
        )}
        <span aria-hidden className="absolute inset-8 rounded-full bg-primary/10" />
        <button
          type="button"
          onClick={enCours ? arreter : commencer}
          disabled={disabled}
          aria-label={enCours ? "Arrêter l’enregistrement" : audio ? "Réenregistrer" : "Commencer l’enregistrement"}
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-card transition-transform hover:scale-105 disabled:opacity-50"
        >
          <Mic size={40} aria-hidden />
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 text-center font-medium tabular-nums text-content">
        {statut}
      </p>

      {(enCours || etat === "termine") && !disabled && (
        <div className="mt-4 flex gap-8">
          {enCours && (
            <Action libelle="Stop" onClick={arreter}>
              <Square size={18} aria-hidden className="fill-error text-error" />
            </Action>
          )}
          <Action libelle="Recommencer" onClick={recommencer}>
            <RotateCcw size={20} aria-hidden className="text-primary" />
          </Action>
        </div>
      )}

      {urlAudio && (
        <audio className="mt-4 w-full max-w-sm" controls src={urlAudio}>
          Lecture de votre enregistrement
        </audio>
      )}
      {erreur && <p role="alert" className="mt-3 text-center text-small text-error">{erreur}</p>}
    </div>
  );
}
