"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useTempsRestant } from "@/hooks/useTempsRestant";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { getErrorMessage } from "@/lib/api-client";
import { DUREE_TEST_MINUTES, etapeDe, positionEtape } from "@/lib/etapesTest";
import { ROUTES } from "@/lib/routes";
import { selectTestEnCours, useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import EnteteEtape from "./EnteteEtape";
import QuestionCard from "./QuestionCard";

/**
 * Page du test : les étapes s'enchaînent (QCM, compréhension orale, expression orale, expression écrite)
 * sous un compte à rebours de 15 minutes ; à zéro, le test est terminé avec les réponses déjà données.
 */
export default function DeroulementTest() {
  const router = useRouter();
  const test = useTestDiagnostic();
  const { etat } = test;
  const [confirmerAbandon, setConfirmerAbandon] = useState(false);
  const sansSession = !useTestDiagnosticStore(selectTestEnCours);
  const secondesRestantes = useTempsRestant(etat.debut, DUREE_TEST_MINUTES);
  const tempsEcoule = secondesRestantes === 0;
  const finAutomatiqueLancee = useRef(false);

  useEffect(() => router.prefetch(ROUTES.apprenant.testDiagnostic.resultats), [router]);

  // Sans session (accès direct à l'URL, test abandonné), on renvoie vers le démarrage ou le résultat.
  useEffect(() => {
    if (!sansSession) return;
    router.replace(etat.phase === "resultat" && etat.resultat
      ? ROUTES.apprenant.testDiagnostic.resultats
      : ROUTES.apprenant.testDiagnostic.demarrage);
  }, [sansSession, etat.phase, etat.resultat, router]);

  // Temps écoulé : le test se termine une fois, avec les réponses déjà enregistrées.
  useEffect(() => {
    if (!tempsEcoule || sansSession || finAutomatiqueLancee.current) return;
    finAutomatiqueLancee.current = true;
    test.terminer();
  }, [tempsEcoule, sansSession, test]);

  if (sansSession || !etat.courante || !etat.langue) return null;

  const etape = etapeDe(etat.courante.competence);
  const enRetour = etat.phase === "retour" && etat.retour !== null;
  const derniere = etat.numeroQuestion >= etat.totalQuestions;
  const occupe = test.reponseEnCours || test.terminaisonEnCours;

  return (
    <div className="mx-auto max-w-2xl">
      <EnteteEtape
        etape={etape}
        position={positionEtape(etat.plan, etape)}
        progression={{
          numero: etat.numeroQuestion,
          faites: etat.numeroQuestion - (enRetour ? 0 : 1),
          total: etat.totalQuestions,
        }}
        secondesRestantes={secondesRestantes}
        onQuitter={() => setConfirmerAbandon(true)}
        quitterDesactive={occupe}
      />

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

      {tempsEcoule && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-card border border-warning bg-warning/10 p-4" data-testid="temps-ecoule">
          <Clock size={20} aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <p className="text-content">
            <span className="font-semibold">Le temps est écoulé.</span>{" "}
            {test.terminaisonEnCours ? "Calcul de votre résultat…" : "Vos réponses déjà validées sont prises en compte."}
          </p>
        </div>
      )}

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
        derniere={derniere}
        bloquee={tempsEcoule}
        onChoixChange={test.choisirReponse}
        onTexteChange={test.choisirTexte}
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
          <button type="button" onClick={test.terminer} className="underline">
            Réessayer le calcul
          </button>
        </Alert>
      )}

      {enRetour && etat.retour && !tempsEcoule && (
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
              <p className="font-semibold">Réponse enregistrée</p>
              <p className="mt-1 text-content-secondary">{etat.retour.evaluation}</p>
              {etat.retour.typeReponse === "audio" && etat.retour.scorePrononciation !== undefined && (
                <p className="mt-2 text-small">Évaluation de la prononciation : {etat.retour.scorePrononciation} / 100</p>
              )}
            </div>
          )}
          <button type="button" className="btn-primary mt-4 w-full" onClick={test.suivante} disabled={test.terminaisonEnCours}>
            {test.terminaisonEnCours
              ? "Calcul du score…"
              : etat.retour.questionSuivante ? "Question suivante" : "Finaliser le test"}
          </button>
        </div>
      )}
    </div>
  );
}
