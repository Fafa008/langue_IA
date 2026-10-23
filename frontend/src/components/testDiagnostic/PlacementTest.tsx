"use client";

import Alert from "@/components/ui/Alert";
import { ArrowRight } from "lucide-react";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { getErrorMessage } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { libelleLangue } from "@/lib/languages";
import type { CodeLangue } from "@/types/langue";
import ChoixLangueTest from "./ChoixLangueTest";
import LevelScale from "./LevelScale";
import PersonalisationForm from "./PersonalisationForm";
import QuestionCard from "./QuestionCard";
import TestResult from "./TestResult";

export default function PlacementTest({ langueInitiale }: { langueInitiale: CodeLangue }) {
  const test = useTestDiagnostic(langueInitiale);
  const { etat } = test;
  const libelle = libelleLangue(etat.langue);

  if (etat.phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Test de positionnement</p>
        <h1 className="mt-2">Évaluons votre niveau</h1>
        <p className="mb-6 mt-1 text-content-secondary">
          Choisissez la langue que vous souhaitez évaluer.
        </p>

        <ChoixLangueTest value={etat.langue} onChange={test.choisirLangue} disabled={test.demarrageEnCours} />

        <ul className="card mt-6 space-y-2">
          <li>Grammaire, compréhension écrite et orale, expression écrite et orale</li>
          <li>La difficulté s&apos;adapte à vos réponses et à votre objectif</li>
        </ul>

        {API_MOCK && (
          <p role="note" className="mt-4 rounded-btn border border-border bg-background p-3 text-small text-content-secondary">
            Mode démonstration : l’évaluation des réponses écrites et orales est simulée jusqu’à la connexion du service IA.
          </p>
        )}
        {!API_MOCK && (
          <p role="note" className="mt-4 rounded-btn border border-border bg-background p-3 text-small text-content-secondary">
            Vos réponses seront enregistrées. Leur évaluation et l’adaptation du parcours seront disponibles après l’intégration du service IA.
          </p>
        )}

        {test.langueIndisponible && (
          <Alert className="mt-4">
            Le test de {libelle.toLowerCase()} n&apos;est pas encore disponible.
          </Alert>
        )}
        {test.erreurDemarrage && !test.langueIndisponible && (
          <Alert className="mt-4">{getErrorMessage(test.erreurDemarrage)}</Alert>
        )}

        <button type="button" className="btn-primary mt-6 w-full" onClick={() => test.personnaliser(etat.personnalisation.objectif, etat.personnalisation.creneaux)}>
          Continuer
        </button>
      </div>
    );
  }

  if (etat.phase === "personnalisation") {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Personnalisation de votre parcours</p>
        <h1 className="mt-2">Quelques questions avant de commencer…</h1>
        <p className="mb-6 mt-2 text-content-secondary">
          Ces informations aident l’IA à adapter le test et vos formateurs à cibler vos ateliers.
        </p>

        <section className="card">
          <PersonalisationForm
            value={etat.personnalisation}
            disabled={test.demarrageEnCours}
            onChange={(personnalisation) => test.personnaliser(personnalisation.objectif, personnalisation.creneaux)}
          />
        </section>

        {test.langueIndisponible && (
          <Alert className="mt-4">
            Le test de {libelle.toLowerCase()} n&apos;est pas encore disponible.
          </Alert>
        )}
        {test.erreurDemarrage && !test.langueIndisponible && (
          <Alert className="mt-4">{getErrorMessage(test.erreurDemarrage)}</Alert>
        )}

        <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-secondary"
            disabled={test.demarrageEnCours}
            onClick={test.retourIntroduction}
          >
            Quitter
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={test.demarrageEnCours || test.langueIndisponible}
            onClick={() => test.demarrer(etat.personnalisation)}
          >
            {test.demarrageEnCours
              ? "Préparation du test…"
              : test.langueIndisponible
                ? "Test indisponible"
                : test.erreurDemarrage
                  ? "Réessayer"
                  : <>Commencer le test IA <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
      </div>
    );
  }

  if (etat.phase === "resultat" && etat.resultat) {
    return (
      <TestResult
        libelleLangue={libelle}
        resultat={etat.resultat}
        onRecommencer={test.recommencer}
      />
    );
  }

  if (etat.phase === "evaluationEnAttente") {
    return (
      <div className="mx-auto max-w-2xl text-center" data-testid="evaluation-pending">
        <p className="eyebrow">Réponses enregistrées</p>
        <h1 className="mt-2">Votre évaluation est en attente</h1>
        <p className="mt-4 text-content-secondary">
          Vos réponses ont été sauvegardées. Le niveau sera évalué lorsque le service IA sera disponible.
        </p>
        <button type="button" className="btn-secondary mt-8" onClick={test.recommencer}>
          Recommencer le test
        </button>
      </div>
    );
  }

  if (!etat.courante || !etat.sessionId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert>La session de test est incomplète. Veuillez recommencer.</Alert>
        <button type="button" className="btn-secondary mt-4" onClick={test.recommencer}>
          Recommencer le test
        </button>
      </div>
    );
  }

  const enRetour = etat.phase === "retour" && etat.retour !== null;
  const progression = etat.totalQuestions > 0
    ? etat.numeroQuestion - (enRetour ? 0 : 1)
    : 0;

  return (
    <div className="mx-auto max-w-2xl">
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
              <p className="mt-1 text-content-secondary">
                L’évaluation sera effectuée lorsque le service IA sera disponible.
              </p>
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
          <button type="button" className="btn-primary mt-4 w-full" onClick={test.suivante}>
            {etat.retour.resultat
              ? "Voir mon résultat"
              : etat.retour.typeReponse === "en_attente" && !etat.retour.questionSuivante
                ? "Terminer"
                : "Question suivante"}
          </button>
        </div>
      )}
    </div>
  );
}
