import { ArrowRight, Bot, CheckCircle2, Cpu, Lightbulb, PenLine, RotateCcw, ThumbsUp } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { PHASES } from "@/lib/parcours-personnalise";
import type { CorrectionExercice } from "@/types/parcours-personnalise";

/**
 * US44 — Retour affiché après une correction : verdict et score, qui a corrigé (automatique ou professeur IA),
 * bonne réponse et explication (QCM), points forts, erreurs relevées et conseil (réponse libre).
 * US157 — un retour de l'IA dit selon quelle phase il a été rédigé (leçon atteinte) ; en phase active,
 * il donne aussi le texte entièrement corrigé.
 */
export default function RetourCorrection({ correction, onReessayer }: { correction: CorrectionExercice; onReessayer: () => void }) {
  const reussi = correction.statut === "REUSSI";
  const ia = correction.mode === "IA";

  return (
    <section
      aria-label="Correction"
      className={`mt-4 rounded-card border p-4 ${reussi ? "border-success/40 bg-success/5" : "border-warning/50 bg-warning/5"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 font-semibold ${reussi ? "text-success-dark" : "text-warning-dark"}`}>
          {reussi ? <CheckCircle2 size={20} aria-hidden /> : <RotateCcw size={20} aria-hidden />}
          {reussi ? "Réussi" : "À revoir"} · {correction.scoreObtenu}/100
        </p>
        <Badge tone="muted" icon={ia ? Bot : Cpu}>
          {ia ? "Corrigé par le professeur IA" : "Correction automatique"}
        </Badge>
      </div>

      {ia && correction.phase && (
        <p className="mt-1 text-small text-content-secondary">
          {PHASES[correction.phase].libelle} (leçon {correction.leconAtteinte}) : {PHASES[correction.phase].retourIA}
        </p>
      )}

      <p className="mt-2 text-content">{correction.commentaire}</p>

      {correction.reponseAttendue && (
        <p className="mt-2 text-content">
          Bonne réponse : <strong>{correction.reponseAttendue}</strong>
        </p>
      )}
      {correction.explication && <p className="mt-1 text-small text-content-secondary">{correction.explication}</p>}

      {correction.pointsForts.length > 0 && (
        <div className="mt-3">
          <h4 className="flex items-center gap-1.5 text-small font-semibold text-success-dark">
            <ThumbsUp size={15} aria-hidden /> Points forts
          </h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-small text-content">
            {correction.pointsForts.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {correction.erreurs.length > 0 && (
        <div className="mt-3">
          <h4 className="text-small font-semibold text-content">
            {correction.erreurs.length} point{correction.erreurs.length > 1 ? "s" : ""} à corriger
          </h4>
          <ul className="mt-1 space-y-2">
            {correction.erreurs.map((erreur, index) => (
              <li key={`${erreur.extrait}-${index}`} className="rounded-btn bg-surface p-2.5 text-small">
                <span className="flex flex-wrap items-center gap-1.5">
                  <del className="text-error-dark">{erreur.extrait}</del>
                  <ArrowRight size={14} aria-label="devient" />
                  <ins className="font-semibold text-success-dark no-underline">{erreur.correction}</ins>
                </span>
                <span className="mt-0.5 block text-content-secondary">{erreur.explication}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {correction.reformulation && (
        <div className="mt-3">
          <h4 className="flex items-center gap-1.5 text-small font-semibold text-content">
            <PenLine size={15} aria-hidden /> Version corrigée
          </h4>
          <blockquote className="mt-1 rounded-btn border-l-4 border-success/50 bg-surface p-2.5 text-small text-content">
            {correction.reformulation}
          </blockquote>
        </div>
      )}

      {correction.conseil && (
        <p className="mt-3 flex items-start gap-2 text-small text-content">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-warning-dark" aria-hidden />
          <span>
            <strong>Conseil :</strong> {correction.conseil}
          </span>
        </p>
      )}

      <button type="button" onClick={onReessayer} className="btn-secondary mt-4 px-4 py-2">
        <RotateCcw size={16} aria-hidden /> {reussi ? "Refaire l'exercice" : "Réessayer"}
      </button>
    </section>
  );
}
