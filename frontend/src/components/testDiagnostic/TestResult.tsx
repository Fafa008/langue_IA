"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Headphones, MessageSquareText, Mic, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTestDiagnostic } from "@/hooks/useTestDiagnostic";
import { libelleLangue as libelleDe } from "@/lib/languages";
import { ROUTES } from "@/lib/routes";
import type { CompetenceTest } from "@/types/test-diagnostic";
import BoutonRetour from "./BoutonRetour";

const DESCRIPTIONS: Record<string, string> = {
  A1: "Débutant",
  A2: "Élémentaire",
  B1: "Intermédiaire",
  B2: "Intermédiaire supérieur",
  C1: "Avancé",
  C2: "Maîtrise",
};

const COMPETENCES: Record<CompetenceTest, { label: string; Icone: LucideIcon }> = {
  grammaire: { label: "Grammaire et vocabulaire", Icone: BookOpenText },
  lecture: { label: "Compréhension écrite", Icone: BookOpenText },
  ecoute: { label: "Compréhension orale", Icone: Headphones },
  ecrit: { label: "Expression écrite", Icone: MessageSquareText },
  oral: { label: "Expression orale", Icone: Mic },
};

/** Échelle complète affichée sous le niveau, du plus bas au plus haut. */
const ECHELLES = {
  CECRL: ["A1", "A2", "B1", "B2", "C1", "C2"],
  HSK: ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"],
} as const;

const pourcentage = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);
const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function BarreProgression({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valeur}
      className="h-2 overflow-hidden rounded-full bg-border"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${valeur}%` }} />
    </div>
  );
}

/**
 * Page des résultats du dernier test terminé (lu dans le store).
 * Le backend renvoie un score sur 100 et le référentiel (`cadre`) ; le mode démo renvoie aussi le détail par compétence.
 */
export default function TestResult() {
  const router = useRouter();
  const test = useTestDiagnostic();
  const { etat } = test;
  const resultat = etat.phase === "resultat" ? etat.resultat : null;

  // Sans test terminé (accès direct à l'URL), retour au démarrage.
  useEffect(() => {
    if (!resultat) router.replace(ROUTES.apprenant.testDiagnostic.demarrage);
  }, [resultat, router]);

  if (!resultat) return null;

  const libelleLangue = libelleDe(etat.langue);
  const scoreGlobal = pourcentage(resultat.score, resultat.total);
  const referentiel = resultat.cadre ?? (resultat.niveau.toUpperCase().startsWith("HSK") ? "HSK" : "CECRL");
  // La tentative ne connaît que son niveau de départ : l'échelle complète du référentiel est affichée.
  const niveaux: readonly string[] = etat.niveaux.length > 1 ? etat.niveaux : ECHELLES[referentiel];
  const detailDisponible = resultat.competences.length > 0;
  const indexNiveau = niveaux.indexOf(resultat.niveau);
  const niveauSuivant = indexNiveau >= 0 ? niveaux[indexNiveau + 1] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="test-result">
      <BoutonRetour href={ROUTES.apprenant.dashboard} libelle="Retour à mon espace" />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Test terminé</p>
          <h1 className="mt-2">Résultat de votre diagnostic</h1>
        </div>
        <span className="self-start rounded-btn bg-primary px-4 py-2 text-small font-semibold text-white sm:self-auto">
          {libelleLangue} · {referentiel}
        </span>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card" aria-labelledby="result-score-title">
          <h2 id="result-score-title" className="text-small text-content-secondary">Score obtenu</h2>
          <p data-testid="result-score" className="mt-2">
            <span className="text-6xl font-bold text-content">{nombre.format(resultat.score)}</span>{" "}
            <span className="text-h3 font-normal text-content-secondary">/ {resultat.total}</span>
          </p>
          <div className="mt-4">
            <BarreProgression label="Score global" valeur={scoreGlobal} />
          </div>
          <p className="mt-3 text-content">
            {resultat.cadre
              ? `${nombre.format(resultat.score)} % de bonnes réponses aux questions à choix`
              : `${resultat.score} réponses correctes sur ${resultat.total} · ${scoreGlobal} %`}
          </p>
        </section>

        <section className="rounded-card bg-primary p-6 text-white shadow-card" aria-labelledby="result-level-title">
          <h2 id="result-level-title" className="text-small text-white/70">
            Votre niveau en {libelleLangue.toLowerCase()}
          </h2>
          <p className="mt-2 flex items-center gap-4">
            <span data-testid="result-level" className="text-6xl font-bold">{resultat.niveau}</span>
            <span data-testid="result-framework" className="rounded-full bg-white px-3 py-1 text-small font-semibold text-primary">
              {referentiel}
            </span>
          </p>
          <p className="mt-4 text-h4">{DESCRIPTIONS[resultat.niveau] ?? "Niveau de référence estimé"}</p>
          <p className="mt-2 text-small text-white/70">
            Estimation indicative issue du test de positionnement adaptatif.
          </p>
        </section>
      </div>

      {niveaux.includes(resultat.niveau) && (
        <section className="card" aria-labelledby="result-scale-title">
          <h2 id="result-scale-title" className="text-small text-content-secondary">Échelle des niveaux</h2>
          <ol className="mt-3 flex flex-wrap gap-2">
            {niveaux.map((n) => (
              <li
                key={n}
                aria-current={n === resultat.niveau ? "step" : undefined}
                className={`min-w-[3rem] flex-1 rounded-btn py-2.5 text-center font-semibold ${
                  n === resultat.niveau ? "bg-primary text-white" : "bg-border text-content"
                }`}
              >
                {n}
              </li>
            ))}
          </ol>
          {niveauSuivant && (
            <p className="mt-3 text-small text-content-secondary">Prochain niveau visé : {niveauSuivant}</p>
          )}
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-5">
        <section className="card md:col-span-3" aria-labelledby="result-skills-title">
          <h2 id="result-skills-title" className="text-small text-content-secondary">Vos compétences</h2>
          {detailDisponible ? (
            <ul className="mt-4 space-y-4">
              {resultat.competences.map(({ competence, score, total }) => {
                const { label, Icone } = COMPETENCES[competence];
                return (
                  <li key={competence} data-testid={`result-competence-${competence}`}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-content">
                        <Icone size={18} aria-hidden="true" className="text-primary" />
                        {label}
                      </span>
                      <span className="font-semibold text-content">{score} / {total}</span>
                    </div>
                    <BarreProgression label={`Résultat ${label}`} valeur={pourcentage(score, total)} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-content-secondary">
              Le détail par compétence sera disponible après l’évaluation par le service IA.
            </p>
          )}
        </section>

        <section className="card flex flex-col md:col-span-2" data-testid="result-weaknesses" aria-labelledby="result-weaknesses-title">
          <h2 id="result-weaknesses-title" className="flex items-center gap-2 text-h3 text-content">
            <TriangleAlert size={20} aria-hidden="true" className="text-warning" />
            Points à renforcer
          </h2>
          {resultat.lacunes.length > 0 ? (
            <ul className="mt-3 list-inside list-disc space-y-1 text-content">
              {resultat.lacunes.map((competence) => (
                <li key={competence}>{COMPETENCES[competence].label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-content">
              {detailDisponible
                ? "Aucun point faible détecté dans ce test."
                : "Ils seront identifiés avec le détail par compétence."}
            </p>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-6">
            <Link href={ROUTES.apprenant.dashboard} className="btn-primary w-full">
              Commencer mon parcours
            </Link>
            <button type="button" className="btn-secondary w-full" onClick={test.recommencer}>
              Refaire le test
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
