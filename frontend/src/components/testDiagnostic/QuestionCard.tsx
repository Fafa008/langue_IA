"use client";

import type { Question } from "@/types/test-diagnostic";
import ListeningAudio from "./ListeningAudio";
import SpeechRecorder from "./SpeechRecorder";

interface QuestionCardProps {
  question: Question;
  langue: string;
  choisie: number | null;
  /** Présent une fois la réponse validée. */
  retour?: { choisie: number; bonneReponse: number };
  reponseLibre?: string;
  audioEnregistre?: Blob | null;
  envoiEnCours: boolean;
  onValider: (choix: number) => void;
  onChoixChange: (choix: number) => void;
  onTexteChange: (texte: string) => void;
  onAudioEnregistre: (audio: Blob) => void;
  onValiderTexte: (texte: string) => void;
  onValiderAudio: (audio: Blob) => void;
}

export default function QuestionCard({
  question,
  langue,
  choisie,
  retour,
  reponseLibre = "",
  audioEnregistre = null,
  envoiEnCours,
  onValider,
  onChoixChange,
  onTexteChange,
  onAudioEnregistre,
  onValiderTexte,
  onValiderAudio,
}: QuestionCardProps) {
  const verrouille = Boolean(retour) || envoiEnCours;
  const coche = retour ? retour.choisie : choisie;
  const competences: Record<Question["competence"], string> = {
    grammaire: "Grammaire et vocabulaire",
    lecture: "Compréhension écrite",
    ecoute: "Compréhension orale",
    ecrit: "Expression écrite",
    oral: "Expression orale",
  };

  return (
    <section className="card" data-testid="question-card" data-question-id={question.id} data-language={langue}>
      <p className="text-small font-semibold text-content-secondary">{competences[question.competence]}</p>
      {question.support && (
        <div className="my-4 rounded-btn bg-background p-4" data-testid="question-support">
          {question.support}
        </div>
      )}
      {question.competence === "ecoute" && (
        <ListeningAudio
          langue={langue}
          audioUrl={question.audioUrl}
          audioTexte={question.audioTexte}
        />
      )}
      <h2 id={`question-${question.id}`} data-testid="question-prompt" className="my-4 text-h3 font-semibold text-content">
        {question.enonce}
      </h2>

      {question.typeReponse === "choix" && (
        <fieldset aria-labelledby={`question-${question.id}`} disabled={verrouille} className="space-y-3">
          <legend className="sr-only">Réponses possibles</legend>
          {(question.choix ?? []).map((texte, i) => {
            const estCoche = coche === i;
            const juste = retour?.bonneReponse === i;
            const faux = Boolean(retour) && estCoche && !juste;
            return (
              <label
                key={`${question.id}-${i}`}
                data-testid={`option-${i}`}
                className={`flex cursor-pointer items-center gap-3 rounded-btn border bg-surface px-4 py-3 ${
                  juste ? "border-success ring-1 ring-success"
                  : faux ? "border-error ring-1 ring-error"
                  : estCoche ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-background"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={estCoche}
                  onChange={() => onChoixChange(i)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{texte}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {!retour && question.typeReponse === "texte" && (
        <label className="mt-4 block font-semibold" htmlFor={`response-${question.id}`}>
          Votre réponse
          <textarea
            id={`response-${question.id}`}
            value={reponseLibre}
            onChange={(event) => onTexteChange(event.target.value)}
            disabled={verrouille}
            rows={5}
            maxLength={2000}
            className="input mt-2 min-h-32 w-full resize-y"
          />
        </label>
      )}

      {!retour && question.typeReponse === "audio" && (
        <SpeechRecorder audio={audioEnregistre} onRecorded={onAudioEnregistre} />
      )}

      {!verrouille && (
        <button
          type="button"
          className="btn-primary mt-6 w-full"
          disabled={
            envoiEnCours
            || (question.typeReponse === "choix" && coche === null)
            || (question.typeReponse === "texte" && !reponseLibre.trim())
            || (question.typeReponse === "audio" && !audioEnregistre)
          }
          onClick={() => {
            if (question.typeReponse === "choix" && coche !== null) onValider(coche);
            else if (question.typeReponse === "texte" && reponseLibre.trim()) onValiderTexte(reponseLibre);
            else if (question.typeReponse === "audio" && audioEnregistre) onValiderAudio(audioEnregistre);
          }}
        >
          {envoiEnCours ? "Envoi…" : "Valider et continuer"}
        </button>
      )}
    </section>
  );
}