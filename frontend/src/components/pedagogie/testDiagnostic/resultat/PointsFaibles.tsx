import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { LIBELLES_DOMAINES } from "@/lib/resultatDiagnostic";
import type { PointFaible } from "@/types/test-diagnostic";

interface PointsFaiblesProps {
  /** null : pas encore connus (analyse incomplète). */
  points: PointFaible[] | null;
  /** Actions affichées sous la liste (commencer le parcours, refaire le test). */
  children?: ReactNode;
}

/** Points faibles repérés par l'analyse (grammaire, vocabulaire, oral…), avec leur explication si elle existe. */
export default function PointsFaibles({ points, children }: PointsFaiblesProps) {
  return (
    <section className="card flex flex-col" data-testid="result-weaknesses" aria-labelledby="result-weaknesses-title">
      <h2 id="result-weaknesses-title" className="flex items-center gap-2 text-h3 text-content">
        <TriangleAlert size={20} aria-hidden="true" className="text-warning" />
        Points à renforcer
      </h2>
      {points === null ? (
        <p className="mt-3 text-content-secondary">Ils seront identifiés par l&apos;analyse complète de vos réponses.</p>
      ) : points.length === 0 ? (
        <p className="mt-3 text-content">Aucun point faible détecté dans ce test.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {points.map(({ domaine, detail }) => (
            <li key={domaine} data-testid={`point-faible-${domaine}`} className="rounded-btn bg-warning/10 px-3 py-2">
              <p className="font-semibold text-content">{LIBELLES_DOMAINES[domaine]}</p>
              {detail && <p className="mt-0.5 text-small text-content-secondary">{detail}</p>}
            </li>
          ))}
        </ul>
      )}
      {children && <div className="mt-auto flex flex-col gap-3 pt-6">{children}</div>}
    </section>
  );
}
