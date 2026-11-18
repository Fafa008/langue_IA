"use client";

import { useCorrigerExercice } from "@/hooks/useParcoursPersonnalise";
import { messageErreurParcours, TYPE_EXERCICE_LABELS } from "@/lib/parcours-personnalise";
import type { ExerciceLecon, ReponseExercice } from "@/types/parcours-personnalise";
import { ICONES_TYPE, StatutExerciceBadge } from "../LigneExercice";
import ExerciceChoix from "./ExerciceChoix";
import ExerciceConversation from "./ExerciceConversation";
import ExercicePrononciation from "./ExercicePrononciation";
import ExerciceRedaction from "./ExerciceRedaction";
import ExerciceTexte from "./ExerciceTexte";
import RetourCorrection from "./RetourCorrection";

/**
 * Un exercice de la leçon (US43) : sa forme de réponse, l'envoi pour correction, puis le retour (US44).
 * Tant que la correction est affichée, la réponse est figée ; « Réessayer » rouvre l'exercice.
 */
export default function ExerciceCarte({ exercice, idParcours, langue }: { exercice: ExerciceLecon; idParcours: number; langue: string }) {
  const correction = useCorrigerExercice(idParcours);
  const Icone = ICONES_TYPE[exercice.type];
  const { contenu } = exercice;
  const titreId = `exercice-${exercice.idParcoursExercice}`;
  const resultat = correction.data ?? null;
  const props = {
    langue,
    enCours: correction.isPending,
    verrouille: resultat !== null,
    onSoumettre: (reponse: ReponseExercice) => correction.mutate({ idParcoursExercice: exercice.idParcoursExercice, reponse }),
  };

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
          {(contenu.format === "choix" || contenu.format === "ecoute") && (
            <ExerciceChoix contenu={contenu} langue={langue} enCours={props.enCours} correction={resultat} onSoumettre={props.onSoumettre} />
          )}
          {contenu.format === "texte" && <ExerciceTexte contenu={contenu} {...props} />}
          {contenu.format === "redaction" && <ExerciceRedaction contenu={contenu} {...props} />}
          {contenu.format === "prononciation" && <ExercicePrononciation contenu={contenu} {...props} />}
          {contenu.format === "conversation" && <ExerciceConversation contenu={contenu} {...props} />}
        </div>

        <div aria-live="polite">
          {resultat && <RetourCorrection correction={resultat} onReessayer={() => correction.reset()} />}
          {correction.isError && (
            <p role="alert" className="msg-error mt-3">
              {messageErreurParcours(correction.error, "La correction de votre réponse")} Votre réponse est conservée : vous pouvez la renvoyer.
            </p>
          )}
        </div>
      </section>
    </li>
  );
}
