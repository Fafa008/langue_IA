"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { useLanguesDiagnostic, useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { getErrorMessage } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { libelleLangue } from "@/lib/languages";
import { DUREE_TEST_MINUTES } from "@/lib/etapesTest";
import { ROUTES } from "@/lib/routes";
import { selectTestEnCours, useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import BoutonRetour from "./BoutonRetour";
import ChoixLangueTest from "./ChoixLangueTest";
import PersonalisationForm from "./PersonalisationForm";

const CONSIGNES = [
  `Le test dure ${DUREE_TEST_MINUTES} minutes et comporte 4 étapes : grammaire et lexique, compréhension orale, expression orale, expression écrite.`,
  "Répondez seul, sans dictionnaire ni traducteur. Prévoyez des écouteurs et un micro.",
  "Pour les questions à choix, une seule réponse est correcte.",
  "Chaque réponse est enregistrée dès que vous la validez : relisez-la avant de valider.",
  "Restez sur la page : si vous la quittez, vous reprendrez le test là où vous en étiez.",
];

/** Chiffre clé du test (« 10 questions »), « – » tant qu'aucune langue n'est choisie. */
function Chiffre({ valeur, libelle }: { valeur: string | number | null; libelle: string }) {
  return (
    <div className="flex flex-col-reverse rounded-btn bg-background p-4 text-center">
      <dt className="text-small text-content-secondary">{libelle}</dt>
      <dd className="text-h3 font-bold text-content">{valeur ?? "–"}</dd>
    </div>
  );
}

/**
 * Écran d'accueil du test : choix de la langue (chargée depuis l'API), consignes et durée estimée,
 * puis personnalisation, jusqu'à la création de la tentative.
 */
export default function PlacementTest({ langueDemandee }: { langueDemandee?: string }) {
  const router = useRouter();
  const test = useTestDiagnostic();
  const langues = useLanguesDiagnostic();
  const { etat } = test;
  const enCours = useTestDiagnosticStore(selectTestEnCours);
  // Langue choisie et réellement disponible : sans elle, le test ne peut pas démarrer
  const langueChoisie = langues.data?.find((l) => l.code === etat.langue && l.disponible) ?? null;

  // Page suivante chargée d'avance : pas d'attente au démarrage du test.
  useEffect(() => router.prefetch(ROUTES.apprenant.testDiagnostic.test), [router]);

  // Arrivée sur la page : un test commencé reprend, un test terminé laisse place à un nouveau.
  useEffect(() => {
    const store = useTestDiagnosticStore.getState();
    if (selectTestEnCours(store)) router.replace(ROUTES.apprenant.testDiagnostic.test);
    else if (store.etat.phase === "resultat") store.dispatch({ type: "recommencer" });
  }, [router]);

  // La langue de l'URL (?langue=en) est présélectionnée si elle est disponible.
  useEffect(() => {
    const demandee = langues.data?.find((l) => l.code === langueDemandee && l.disponible);
    const { etat: actuel, dispatch } = useTestDiagnosticStore.getState();
    if (demandee && actuel.phase === "intro" && actuel.langue !== demandee.code) {
      dispatch({ type: "choisirLangue", langue: demandee.code });
    }
  }, [langues.data, langueDemandee]);

  if (enCours) return null;

  const erreurs = (
    <>
      {test.langueIndisponible && (
        <Alert className="mt-4">
          Le test de {libelleLangue(etat.langue ?? "").toLowerCase()} n&apos;est pas encore disponible.
        </Alert>
      )}
      {test.erreurDemarrage && !test.langueIndisponible && (
        <Alert className="mt-4">{getErrorMessage(test.erreurDemarrage)}</Alert>
      )}
    </>
  );

  if (etat.phase === "personnalisation") {
    return (
      <div className="mx-auto max-w-3xl">
        <BoutonRetour onClick={test.retourIntroduction} libelle="Retour au choix de la langue" disabled={test.demarrageEnCours} />
        <p className="eyebrow">Personnalisation de votre parcours</p>
        <h1 className="mt-2">Quelques questions avant de commencer…</h1>

        <section className="card mt-6">
          <PersonalisationForm value={etat.personnalisation} disabled={test.demarrageEnCours} onChange={test.personnaliser} />
        </section>

        {erreurs}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={test.demarrageEnCours || test.langueIndisponible}
            onClick={test.demarrer}
          >
            {test.demarrageEnCours
              ? "Préparation du test…"
              : test.langueIndisponible
                ? "Test indisponible"
                : test.erreurDemarrage
                  ? "Réessayer"
                  : <>Lancer le test <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BoutonRetour href={ROUTES.apprenant.dashboard} libelle="Retour à mon espace" />
      <p className="eyebrow">Test de positionnement</p>
      <h1 className="mt-2">Évaluez votre niveau</h1>
      <p className="mt-2 text-content-secondary">
        Un test court pour situer votre niveau et construire un parcours adapté. Commencez par choisir la langue à évaluer.
      </p>

      <section className="card mt-6" aria-labelledby="etape-langue">
        <h2 id="etape-langue" className="mb-4 text-h3 text-content">1. Choisissez la langue</h2>
        {langues.isPending ? (
          <p role="status" className="input flex min-h-[3.5rem] animate-pulse items-center text-content-secondary">
            Chargement des langues…
          </p>
        ) : langues.isError ? (
          <Alert>
            Les langues n&apos;ont pas pu être chargées. {getErrorMessage(langues.error)}{" "}
            <button type="button" onClick={() => langues.refetch()} className="underline">
              Réessayer
            </button>
          </Alert>
        ) : (
          <ChoixLangueTest
            langues={langues.data}
            value={etat.langue}
            onChange={test.choisirLangue}
            labelledBy="etape-langue"
          />
        )}
      </section>

      <section className="card mt-6" aria-labelledby="etape-consignes">
        <h2 id="etape-consignes" className="mb-4 text-h3 text-content">2. Avant de commencer</h2>
        <ul className="list-inside list-disc space-y-2 text-content" data-testid="consignes">
          {CONSIGNES.map((consigne) => <li key={consigne}>{consigne}</li>)}
        </ul>
        <dl className="mt-6 grid grid-cols-3 gap-3" data-testid="chiffres-test">
          <Chiffre valeur={langueChoisie?.nombreQuestions ?? null} libelle="questions" />
          <Chiffre valeur={langueChoisie ? `${DUREE_TEST_MINUTES} min` : null} libelle="de durée estimée" />
          <Chiffre valeur={langueChoisie?.niveaux.length ?? null} libelle="niveaux estimés" />
        </dl>
      </section>

      {API_MOCK && (
        <p role="note" className="mt-4 rounded-btn border border-border bg-background p-3 text-small text-content-secondary">
          Mode démonstration : l’évaluation des réponses écrites et orales est simulée jusqu’à la connexion du service IA.
        </p>
      )}

      {erreurs}

      <button
        type="button"
        className="btn-primary mt-6 w-full"
        disabled={!langueChoisie}
        aria-describedby={langueChoisie ? undefined : "aide-demarrage"}
        onClick={() => test.personnaliser(etat.personnalisation)}
      >
        Commencer le test <ArrowRight size={18} aria-hidden="true" />
      </button>
      {!langueChoisie && (
        <p id="aide-demarrage" className="mt-2 text-center text-small text-content-secondary">
          Choisissez une langue pour commencer.
        </p>
      )}
    </div>
  );
}
