"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

interface SpeechRecorderProps {
  audio: Blob | null;
  onRecorded: (audio: Blob) => void;
}

export default function SpeechRecorder({ audio, onRecorded }: SpeechRecorderProps) {
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [urlAudio, setUrlAudio] = useState<string | null>(null);

  useEffect(() => {
    if (!audio) {
      setUrlAudio(null);
      return;
    }
    const url = URL.createObjectURL(audio);
    setUrlAudio(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
  }, []);

  const visualiser = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const values = new Uint8Array(analyser.fftSize);
    const dessiner = () => {
      analyser.getByteTimeDomainData(values);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 2;
      context.strokeStyle = "#d93838";
      context.beginPath();
      values.forEach((value, index) => {
        const x = (index / values.length) * canvas.width;
        const y = (value / 255) * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      frameRef.current = requestAnimationFrame(dessiner);
    };
    dessiner();
  };

  const commencer = async () => {
    setErreur(null);
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
        const enregistrementAudio = new Blob(morceaux, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setEnregistrement(false);
        if (enregistrementAudio.size > 0) onRecorded(enregistrementAudio);
      };
      recorderRef.current = recorder;
      const audioContext = new AudioContext();
      contextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      visualiser(analyser);
      recorder.start();
      setEnregistrement(true);
    } catch {
      setErreur("Impossible d’accéder au microphone. Vérifiez son autorisation puis réessayez.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const arreter = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
  };

  return (
    <div className="mt-5 rounded-btn border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={enregistrement ? "btn-danger" : "btn-secondary"}
          onClick={enregistrement ? arreter : commencer}
        >
          {enregistrement
            ? <><Square size={16} aria-hidden="true" /> Arrêter l’enregistrement</>
            : <><Mic size={18} aria-hidden="true" /> {audio ? "Réenregistrer" : "Enregistrer ma réponse"}</>}
        </button>
        <span role="status" aria-live="polite" className="text-small text-content-secondary">
          {enregistrement ? "Enregistrement en cours…" : audio ? "Enregistrement prêt" : "Aucun enregistrement"}
        </span>
      </div>
      <canvas ref={canvasRef} width={640} height={64} aria-label="Visualisation de l’enregistrement" className="mt-3 h-16 w-full" />
      {urlAudio && <audio className="mt-3 w-full" controls src={urlAudio}>Lecture de votre enregistrement</audio>}
      {erreur && <p role="alert" className="mt-3 text-small text-error">{erreur}</p>}
    </div>
  );
}
