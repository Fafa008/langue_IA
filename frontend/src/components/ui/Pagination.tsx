import { ChevronLeft, ChevronRight } from "lucide-react";
import { ELLIPSE, pagesAffichees } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const pageButton = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-body font-medium transition-colors";

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${pageButton} gap-1 border border-border bg-surface text-content hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50`}
      >
        <ChevronLeft size={16} aria-hidden />
        <span className="hidden sm:inline">Précédent</span>
        <span className="sr-only sm:hidden">Page précédente</span>
      </button>

      {/* Numéros masqués sur petit écran : la position s'affiche en texte */}
      <span className="px-2 text-content-secondary sm:hidden">
        {page} / {totalPages}
      </span>
      <ul className="hidden items-center gap-1 sm:flex">
        {pagesAffichees(page, totalPages).map((p, i) =>
          p === ELLIPSE ? (
            <li key={`ellipse-${i}`} className="px-1 text-content-secondary" aria-hidden>
              {ELLIPSE}
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`${pageButton} ${p === page ? "bg-primary text-white" : "text-content hover:bg-background hover:text-primary"}`}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`${pageButton} gap-1 border border-border bg-surface text-content hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50`}
      >
        <span className="hidden sm:inline">Suivant</span>
        <span className="sr-only sm:hidden">Page suivante</span>
        <ChevronRight size={16} aria-hidden />
      </button>
    </nav>
  );
}
