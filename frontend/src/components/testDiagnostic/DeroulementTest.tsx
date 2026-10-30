"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { getErrorMessage } from "@/lib/api-client";
import { libelleLangue } from "@/lib/languages";
import { ROUTES } from "@/lib/routes";
import { selectTestEnCours, useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import BoutonRetour from "./BoutonRetour";
import LevelScale from "./LevelScale";
import QuestionCard from "./QuestionCard";

/** Page du test : question courante, correction et progression, jusqu'au résultat. */
export default function DeroulementTest() {
  const router = useRouter();
  const test = useTestDiagnostic();
  const { etat } = test;
  const [confirmerAbandon, setConfirmerAbandon] = useState(false);
  const sansSession = !useTestDiagnosticStore(selectTestEnCours);

  useEffect(() => router.prefetch(ROUTES.apprenant.testDiagnostic.resultats), [router]);

  // Sans session (accès direct à l'URL, test abandonné), on renvoie vers le démarrage ou le résultat.
  useEffect(() => {
    if (!sansSession) return;
    router.replace(etat.phase === "resultat" && etat.resultat
      ? ROUTES.apprenant.testDiagnostic.resultats
      : ROUTES.apprenant.testDiagnostic.demarrage);
  }, [sansSession, etat.phase, etat.resultat, router]);

  if (sansSession || !etat.courante || !etat.langue) return null;

  const libelle = libelleLangue(etat.langue);

  const enRetour = etat.phase === "retour" && etat.retour !== null;
  const progression = etat.totalQuestions > 0
    ? etat.numeroQuestion - (enRetour ? 0 : 1)
    : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <BoutonRetour onClick={() => setConfirmerAbandon(true)} libelle="Quitter le test" disabled={test.reponseEnCours || test.terminaisonEnCours} />
      {confirmerAbandon && (
        <ConfirmDialog
          title="Quitter le test ?"
          description="Le test en cours sera abandonné et vos réponses ne seront pas conservées."
          confirmLabel="Quitter le test"
          onClose={() => setConfirmerAbandon(false)}
          onConfirm={() => {
            setConfirmerAbandon(false);
            test.recommencer();
          }}
        />
      )}
      <div className="mb-2 flex justify-between text-small font-semibold">
        <span data-testid="progress-label">
          Question {etat.numeroQuestion} sur {etat.totalQuestions}
        </span>
        <span className="text-content-secondary">{libelle}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Progression du test"
        aria-valuemin={0}
        aria-valuemax={etat.totalQuestions}
        aria-valuenow={progression}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(progression / etat.totalQuestions) * 100}%` }}
        />
      </div>

      <LevelScale niveau={etat.courante.niveau} niveaux={etat.niveaux} />

      <QuestionCard
        key={etat.courante.id}
        question={etat.courante}
        langue={etat.langue}
        choisie={etat.choisie}
        reponseLibre={etat.texteSaisi}
        audioEnregistre={etat.audioEnregistre}
        retour={
          enRetour && etat.retour?.typeReponse === "choix" && etat.choisie !== null
            ? { choisie: etat.choisie, bonneReponse: etat.retour.bonneReponse }
            : undefined
        }
        envoiEnCours={test.reponseEnCours}
        onChoixChange={test.choisirReponse}
        onTexteChange={(texte) => test.choisirTexte(texte)}
        onAudioEnregistre={test.choisirAudio}
        onValider={test.repondre}
        onValiderTexte={test.repondreTexte}
        onValiderAudio={test.repondreAudio}
      />

      {test.erreurReponse && (
        <Alert className="mt-4">
          {getErrorMessage(test.erreurReponse)}{" "}
          <button type="button" onClick={test.reessayerReponse} className="underline">
            Réessayer
          </button>
        </Alert>
      )}

      {test.erreurTerminaison && (
        <Alert className="mt-4">
          {getErrorMessage(test.erreurTerminaison)}{" "}
          <button type="button" onClick={test.reessayerTerminaison} className="underline">
            Réessayer le calcul
          </button>
        </Alert>
      )}

      {enRetour && etat.retour && (
        <div
          role="status"
          data-testid="feedback"
          className={`mt-4 rounded-card border bg-surface p-4 ${
            etat.retour.typeReponse === "choix"
              ? etat.retour.correcte ? "border-success" : "border-error"
              : "border-primary"
          }`}
        >
          {etat.retour.typeReponse === "choix" ? (
            <p className={`font-semibold ${etat.retour.correcte ? "text-success" : "text-error"}`}>
              {etat.retour.correcte
                ? "Bonne réponse"
                : `Réponse incorrecte. Bonne réponse : ${etat.courante.choix?.[etat.retour.bonneReponse]}`}
            </p>
          ) : etat.retour.typeReponse === "en_attente" ? (
            <div>
              <p className="font-semibold">Réponse enregistrée</p>
              <p className="mt-1 text-content-secondary">Cette réponse est enregistrée. Le score sera calculé à la fin du test.</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold">Réponse reçue</p>
              <p className="mt-1 text-content-secondary">{etat.retour.evaluation}</p>
              {etat.retour.typeReponse === "audio" && etat.retour.scorePrononciation !== undefined && (
                <p className="mt-2 text-small">Évaluation de la prononciation : {etat.retour.scorePrononciation} / 100</p>
              )}
            </div>
          )}
          <button type="button" className="btn-primary mt-4 w-full" onClick={test.suivante} disabled={test.terminaisonEnCours}>
            {test.terminaisonEnCours
              ? "Calcul du score…"
              : etat.retour.questionSuivante
                ? "Question suivante"
                : etat.retour.resultat ? "Voir mon résultat" : "Terminer"}
          </button>
        </div>
      )}
    </div>
  );
}
