"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useCorrigerExercice } from "@/hooks/useParcoursPersonnalise";
import { messageErreurParcours, TYPE_EXERCICE_LABELS } from "@/lib/parcours-personnalise";
import type { ExerciceLecon } from "@/types/parcours-personnalise";
import { ICONES_TYPE, StatutExerciceBadge } from "../LigneExercice";
import ExerciceChoix from "./ExerciceChoix";
import ExerciceConversation from "./ExerciceConversation";
import ExercicePrononciation from "./ExercicePrononciation";
import ExerciceTexte from "./ExerciceTexte";

/** Un exercice de la leçon : sa forme de réponse, l'envoi, puis la correction affichée sous l'exercice. */
export default function ExerciceCarte({ exercice, idParcours, langue }: { exercice: ExerciceLecon; idParcours: number; langue: string }) {
  const correction = useCorrigerExercice(idParcours);
  const Icone = ICONES_TYPE[exercice.type];
  const { contenu } = exercice;
  const titreId = `exercice-${exercice.idParcoursExercice}`;
  const props = {
    langue,
    enCours: correction.isPending,
    onSoumettre: (reponse: Parameters<typeof correction.mutate>[0]["reponse"]) =>
      correction.mutate({ idParcoursExercice: exercice.idParcoursExercice, reponse }),
  };
  const resultat = correction.data;

  return (
    <li>
      <section aria-labelledby={titreId} className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary/10 text-primary">
              <Icone size={20} />
            </span>
            <div>
              <h3 id={titreId} className="font-semibold text-primary">
                {exercice.intitule ?? TYPE_EXERCICE_LABELS[exercice.type]}
              </h3>
              <p className="text-small text-content-secondary">
                {TYPE_EXERCICE_LABELS[exercice.type]} · Difficulté {exercice.difficulte}/5
              </p>
            </div>
          </div>
          <StatutExerciceBadge statut={resultat?.statut ?? exercice.statut} score={resultat?.scoreObtenu ?? exercice.scoreObtenu} />
        </div>
        <p className="mt-3 text-content">{contenu.consigne}</p>

        <div className="mt-3">
          {(contenu.format === "choix" || contenu.format === "ecoute") && <ExerciceChoix contenu={contenu} {...props} />}
          {contenu.format === "texte" && <ExerciceTexte contenu={contenu} {...props} />}
          {contenu.format === "prononciation" && <ExercicePrononciation contenu={contenu} {...props} />}
          {contenu.format === "conversation" && <ExerciceConversation contenu={contenu} {...props} />}
        </div>

        <div aria-live="polite">
          {resultat && (
            <p
              className={`mt-4 flex items-start gap-2 rounded-btn p-3 ${
                resultat.statut === "REUSSI" ? "bg-success/10 text-success-dark" : "bg-warning/10 text-warning-dark"
              }`}
            >
              {resultat.statut === "REUSSI" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
              ) : (
                <RotateCcw size={18} className="mt-0.5 shrink-0" aria-hidden />
              )}
              <span>
                {resultat.commentaire} <span className="font-semibold">({resultat.scoreObtenu}/100)</span>
                {resultat.reponseAttendue && <span className="block font-semibold">Réponse attendue : {resultat.reponseAttendue}</span>}
                {resultat.statut === "A_REVOIR" && <span className="block">Vous pouvez réessayer.</span>}
              </span>
            </p>
          )}
          {correction.isError && (
            <p role="alert" className="msg-error mt-3">
              {messageErreurParcours(correction.error, "La correction de votre réponse")}
            </p>
          )}
        </div>
      </section>
    </li>
  );
}
