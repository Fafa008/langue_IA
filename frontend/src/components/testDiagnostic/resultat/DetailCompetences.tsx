import { BookOpenText, Headphones, MessageSquareText, Mic, type LucideIcon } from "lucide-react";
import type { CompetenceResultat, CompetenceTest } from "@/types/test-diagnostic";
import BarreProgression from "./BarreProgression";
import { pourcentage } from "./CarteScore";

const COMPETENCES: Record<CompetenceTest, { label: string; Icone: LucideIcon }> = {
  grammaire: { label: "Grammaire et vocabulaire", Icone: BookOpenText },
  lecture: { label: "Compréhension écrite", Icone: BookOpenText },
  ecoute: { label: "Compréhension orale", Icone: Headphones },
  ecrit: { label: "Expression écrite", Icone: MessageSquareText },
  oral: { label: "Expression orale", Icone: Mic },
};

/** Score de chaque compétence évaluée, ou message si l'analyse ne les détaille pas encore. */
export default function DetailCompetences({ competences }: { competences: CompetenceResultat[] }) {
  return (
    <section className="card" aria-labelledby="result-skills-title">
      <h2 id="result-skills-title" className="text-small text-content-secondary">Vos compétences</h2>
      {competences.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {competences.map(({ competence, score, total }) => {
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
        <p className="mt-2 text-content-secondary">Le détail par compétence sera disponible après l’analyse complète.</p>
      )}
    </section>
  );
}
