"use client";

import { compterMots, DUREE_ORALE_MINIMALE_SECONDES, ETAPES, etapeDe, MOTS_ECRITS_MINIMUM } from "@/lib/etapesTest";
import type { Question } from "@/types/test-diagnostic";
import EnregistrementOral from "./EnregistrementOral";
import ListeningAudio from "./ListeningAudio";
import RedactionEcrite from "./RedactionEcrite";

interface QuestionCardProps {
  question: Question;
  langue: string;
  choisie: number | null;
  /** Présent une fois la réponse validée. */
  retour?: { choisie: number; bonneReponse: number };
  reponseLibre?: string;
  audioEnregistre?: Blob | null;
  envoiEnCours: boolean;
  /** Dernière question du test : le bouton annonce la fin. */
  derniere?: boolean;
  /** Temps écoulé : plus aucune réponse n'est possible. */
  bloquee?: boolean;
  onValider: (choix: number) => void;
  onChoixChange: (choix: number) => void;
  onTexteChange: (texte: string) => void;
  onAudioEnregistre: (audio: Blob | null) => void;
  onValiderTexte: (texte: string) => void;
  onValiderAudio: (audio: Blob) => void;
}

/** Question du test, présentée selon son étape : QCM, écoute puis QCM, enregistrement oral ou rédaction. */
export default function QuestionCard({
  question,
  langue,
  choisie,
  retour,
  reponseLibre = "",
  audioEnregistre = null,
  envoiEnCours,
  derniere = false,
  bloquee = false,
  onValider,
  onChoixChange,
  onTexteChange,
  onAudioEnregistre,
  onValiderTexte,
  onValiderAudio,
}: QuestionCardProps) {
  const etape = etapeDe(question.competence);
  const verrouille = Boolean(retour) || envoiEnCours || bloquee;
  const coche = retour ? retour.choisie : choisie;
  // Un sujet d'expression écrite attend un texte construit ; une autre question à texte, une réponse courte
  const motsMinimum = etape === "expression_ecrite" ? question.motsMinimum ?? MOTS_ECRITS_MINIMUM : 1;
  const sujet = etape === "expression_orale" || etape === "expression_ecrite";

  const reponsePrete =
    (question.typeReponse === "choix" && coche !== null)
    || (question.typeReponse === "texte" && compterMots(reponseLibre) >= motsMinimum)
    || (question.typeReponse === "audio" && audioEnregistre !== null);

  const valider = () => {
    if (question.typeReponse === "choix" && coche !== null) onValider(coche);
    else if (question.typeReponse === "texte") onValiderTexte(reponseLibre);
    else if (question.typeReponse === "audio" && audioEnregistre) onValiderAudio(audioEnregistre);
  };

  return (
    <section
      className="card"
      data-testid="question-card"
      data-question-id={question.id}
      data-language={langue}
      aria-labelledby={`question-${question.id}`}
    >
      <p className="text-small font-medium text-content-secondary">{ETAPES[etape].consigne}</p>

      {question.support && (
        <div className="mt-4 rounded-btn bg-background p-4 leading-relaxed" data-testid="question-support">
          {question.support}
        </div>
      )}

      {etape === "comprehension_orale" && (
        <ListeningAudio langue={langue} audioUrl={question.audioUrl} audioTexte={question.audioTexte} />
      )}

      <h2
        id={`question-${question.id}`}
        data-testid="question-prompt"
        className={`mt-4 text-h4 font-semibold text-content sm:text-h3 ${
          sujet ? "rounded-card border border-border bg-background p-4 leading-relaxed sm:p-5" : ""
        }`}
      >
        {sujet && <span className="text-primary">Sujet : </span>}
        {question.enonce}
      </h2>

      {question.typeReponse === "choix" && (
        <fieldset aria-labelledby={`question-${question.id}`} disabled={verrouille} className="mt-4 space-y-3">
          <legend className="sr-only">Réponses possibles</legend>
          {(question.choix ?? []).map((texte, i) => {
            const estCoche = coche === i;
            const juste = retour?.bonneReponse === i;
            const faux = Boolean(retour) && estCoche && !juste;
            return (
              <label
                key={`${question.id}-${i}`}
                data-testid={`option-${i}`}
                className={`flex min-h-[3rem] cursor-pointer items-center gap-3 rounded-btn border bg-surface px-4 py-3 transition-colors ${
                  juste ? "border-success ring-1 ring-success"
                  : faux ? "border-error ring-1 ring-error"
                  : estCoche ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-background"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={estCoche}
                  onChange={() => onChoixChange(i)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span>{texte}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {!retour && question.typeReponse === "texte" && (
        <RedactionEcrite
          id={`response-${question.id}`}
          valeur={reponseLibre}
          onChange={onTexteChange}
          motsMinimum={motsMinimum}
          disabled={verrouille}
        />
      )}

      {!retour && question.typeReponse === "audio" && (
        <EnregistrementOral
          audio={audioEnregistre}
          dureeMinimale={question.dureeMinimaleSecondes ?? DUREE_ORALE_MINIMALE_SECONDES}
          onChange={onAudioEnregistre}
          disabled={verrouille}
        />
      )}

      {!verrouille && (
        <button type="button" className="btn-primary mt-6 w-full" disabled={!reponsePrete} onClick={valider}>
          {derniere ? "Valider et finaliser" : "Valider et continuer"}
        </button>
      )}
      {envoiEnCours && <p role="status" className="mt-6 text-center text-content-secondary">Envoi de votre réponse…</p>}
    </section>
  );
}
