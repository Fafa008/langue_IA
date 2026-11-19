import { BookMarked, ExternalLink } from "lucide-react";
import { estLienSur, estRepereNonOfficiel } from "@/lib/resultatDiagnostic";
import type { Justification } from "@/types/test-diagnostic";

/**
 * « Pourquoi ce niveau ? » : synthèse du LLM et descripteurs du référentiel (RAG) sur lesquels elle s'appuie.
 * Chaque source se déplie pour lire l'extrait ; le lien vers le référentiel n'est fourni que s'il est sûr.
 */
export default function JustificationNiveau({ justification }: { justification?: Justification }) {
  return (
    <section className="card" data-testid="result-justification" aria-labelledby="result-justification-title">
      <h2 id="result-justification-title" className="flex items-center gap-2 text-h3 text-content">
        <BookMarked size={20} aria-hidden className="text-primary" />
        Pourquoi ce niveau ?
      </h2>
      {!justification ? (
        <p className="mt-3 text-content-secondary">
          La justification détaillée, appuyée sur les descripteurs du référentiel, sera disponible après l&apos;analyse complète.
        </p>
      ) : (
        <>
          <p className="mt-3 leading-relaxed text-content" data-testid="justification-resume">{justification.resume}</p>
          {justification.sources.length > 0 && (
            <div className="mt-5">
              <h3 className="text-small font-semibold text-content-secondary">
                Sources du référentiel ({justification.sources.length})
              </h3>
              {justification.sources.some(estRepereNonOfficiel) && (
                <p data-testid="reperes-non-officiels" className="mt-2 rounded-btn bg-warning/10 px-3 py-2 text-small text-content">
                  <span className="font-semibold">Repères non officiels.</span> Ces repères pédagogiques ne sont pas extraits
                  d&apos;un référentiel officiel : ils servent de repère provisoire.
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {justification.sources.map((source) => (
                  <li key={source.id}>
                    <details className="group rounded-btn border border-border" data-testid="source-referentiel">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-content hover:bg-background">
                        <span>
                          {source.titre}
                          {estRepereNonOfficiel(source) && (
                            <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-small font-semibold text-warning-dark">
                              Repère non officiel
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-small font-semibold text-primary">
                          {source.referentiel} · {source.niveau}
                        </span>
                      </summary>
                      <div className="border-t border-border px-4 py-3">
                        <blockquote className="border-l-4 border-primary/30 pl-3 italic text-content-secondary">
                          {source.extrait}
                        </blockquote>
                        {estLienSur(source.url) && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 text-small font-semibold text-primary hover:underline"
                          >
                            Consulter le référentiel <ExternalLink size={14} aria-hidden />
                            <span className="sr-only">(nouvel onglet)</span>
                          </a>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
