import Link from "next/link";
import { BookOpenText, Headphones, MessageSquareText, Mic, TriangleAlert, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import type { CompetenceTest, ResultatTest } from "@/types/test-diagnostic";

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

interface TestResultProps {
  libelleLangue: string;
  resultat: ResultatTest;
  onRecommencer: () => void;
}

export default function TestResult({ libelleLangue, resultat, onRecommencer }: TestResultProps) {
  return (
    <div className="mx-auto max-w-2xl text-center" data-testid="test-result">
      <p className="eyebrow">Test terminé</p>
      <h1 className="mt-2">Votre niveau en {libelleLangue.toLowerCase()}</h1>

      <div className="mx-auto my-8 flex h-36 w-36 items-center justify-center rounded-full bg-primary">
        <span data-testid="result-level" className="text-5xl font-bold text-white">
          {resultat.niveau}
        </span>
      </div>

      <p className="text-h4 font-semibold">{DESCRIPTIONS[resultat.niveau] ?? "Niveau évalué"}</p>
      <p className="mt-1 text-content-secondary">
        Score : <span data-testid="result-score">{resultat.score} / {resultat.total}</span>
      </p>

      <section className="card mt-8 text-left" aria-labelledby="result-skills-title">
        <h2 id="result-skills-title" className="text-h4 font-semibold">Vos compétences</h2>
        {resultat.competences.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {resultat.competences.map(({ competence, score, total }) => {
              const { label, Icone } = COMPETENCES[competence];
              const pourcentage = total ? Math.round((score / total) * 100) : 0;
              return (
                <li key={competence} data-testid={`result-competence-${competence}`}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <Icone size={18} aria-hidden="true" className="text-primary" />
                      {label}
                    </span>
                    <span className="text-small text-content-secondary">{score} / {total}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Résultat ${label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pourcentage}
                    className="h-2 overflow-hidden rounded-full bg-border"
                  >
                    <div className="h-full bg-primary" style={{ width: `${pourcentage}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-content-secondary">Aucun détail par compétence n’est disponible.</p>
        )}

        <div className="mt-6 border-t border-border pt-4" data-testid="result-weaknesses">
          <h3 className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={18} aria-hidden="true" className="text-warning" />
            Points à renforcer
          </h3>
          {resultat.lacunes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-content-secondary">
              {resultat.lacunes.map((competence) => (
                <li key={competence}>{COMPETENCES[competence].label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-content-secondary">Aucun point faible détecté dans ce test.</p>
          )}
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={ROUTES.apprenant.dashboard} className="btn-primary">Retour à mon espace apprenant</Link>
        <button type="button" className="btn-secondary" onClick={onRecommencer}>Refaire le test</button>
      </div>
    </div>
  );
}