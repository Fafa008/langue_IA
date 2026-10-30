"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useTempsRestant } from "@/hooks/useTempsRestant";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { erreurReessayable, messageErreurDiagnostic } from "@/lib/erreursDiagnostic";
import { DUREE_TEST_MINUTES, etapeDe, positionEtape } from "@/lib/etapesTest";
import { ROUTES } from "@/lib/routes";
import { selectTestEnCours, useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import AnalyseEnCours from "./AnalyseEnCours";
import EnteteEtape from "./EnteteEtape";
import ErreurReessayable from "./ErreurReessayable";
import QuestionCard from "./QuestionCard";
import ResultatEnAttente from "./ResultatEnAttente";

/** Résultat en attente : on le redemande automatiquement à cet intervalle, 30 fois au plus (5 minutes). */
const VERIFICATION_RESULTAT_SECONDES = 10;
const VERIFICATIONS_AUTOMATIQUES_MAX = 30;

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
  // Une fois le résultat « en attente », l'écran le reste pendant les vérifications suivantes
  const [attenteSignalee, setAttenteSignalee] = useState(false);
  const [verificationsAutomatiques, setVerificationsAutomatiques] = useState(0);
  const verificationAutomatique = verificationsAutomatiques < VERIFICATIONS_AUTOMATIQUES_MAX;
  const { resultatEnAttente } = test;
  // Toujours la dernière version de terminer, sans réarmer les minuteurs à chaque rendu (le compte à rebours en provoque un par seconde)
  const terminerRef = useRef(test.terminer);
  terminerRef.current = test.terminer;

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
    terminerRef.current();
  }, [tempsEcoule, sansSession]);

  useEffect(() => {
    if (resultatEnAttente) setAttenteSignalee(true);
  }, [resultatEnAttente]);

  // Résultat en attente : nouvelle demande automatique après quelques secondes, dans la limite fixée
  useEffect(() => {
    if (!resultatEnAttente || !verificationAutomatique) return;
    const minuteur = setTimeout(() => {
      setVerificationsAutomatiques((n) => n + 1);
      terminerRef.current();
    }, VERIFICATION_RESULTAT_SECONDES * 1000);
    return () => clearTimeout(minuteur);
  }, [resultatEnAttente, verificationAutomatique]);

  if (sansSession || !etat.courante || !etat.langue) return null;

  const etape = etapeDe(etat.courante.competence);
  const enRetour = etat.phase === "retour" && etat.retour !== null;
  const derniere = etat.numeroQuestion >= etat.totalQuestions;
  const occupe = test.reponseEnCours || test.terminaisonEnCours;
  const enAttente = attenteSignalee && !test.erreurTerminaison;

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

      {enAttente ? (
        <ResultatEnAttente
          verificationEnCours={test.terminaisonEnCours}
          onVerifier={test.terminer}
          intervalleSecondes={verificationAutomatique ? VERIFICATION_RESULTAT_SECONDES : null}
        />
      ) : (
        <>
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
            bloquee={tempsEcoule || enRetour}
            onChoixChange={test.choisirReponse}
            onTexteChange={test.choisirTexte}
            onAudioEnregistre={test.choisirAudio}
            onValider={test.repondre}
            onValiderTexte={test.repondreTexte}
            onValiderAudio={test.repondreAudio}
          />

          {test.erreurReponse && (
            <ErreurReessayable
              message={messageErreurDiagnostic(test.erreurReponse, "reponse")}
              onReessayer={erreurReessayable(test.erreurReponse) ? test.reessayerReponse : undefined}
            />
          )}

          {test.terminaisonEnCours && (
            <div className="mt-4">
              <AnalyseEnCours
                titre="Analyse de vos réponses"
                message="Nous calculons votre niveau à partir de l'ensemble de vos réponses."
              />
            </div>
          )}
          {test.erreurTerminaison && !test.terminaisonEnCours && (
            <ErreurReessayable
              message={messageErreurDiagnostic(test.erreurTerminaison, "analyse")}
              onReessayer={erreurReessayable(test.erreurTerminaison) ? test.terminer : undefined}
            />
          )}

          {enRetour && etat.retour && !tempsEcoule && !test.terminaisonEnCours && !test.erreurTerminaison && (
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
              <button type="button" className="btn-primary mt-4 w-full" onClick={test.suivante}>
                {etat.retour.questionSuivante ? "Question suivante" : "Finaliser le test"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
