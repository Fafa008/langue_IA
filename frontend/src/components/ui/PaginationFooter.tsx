import { pluriel } from "@/lib/format";
import { TAILLES_PAGE, nombreDePages } from "@/lib/pagination";
import type { Paginated } from "@/types/pagination";
import Pagination from "./Pagination";

interface PaginationFooterProps {
  data: Paginated<unknown>;
  /** Nom des éléments, au singulier : « utilisateur », « langue ». */
  element: string;
  onPage: (page: number) => void;
  onTaille: (taille: number) => void;
}

/** Bas de liste : nombre d'éléments par page, position (« 11–20 sur 47 ») et pagination. */
export default function PaginationFooter({ data, element, onPage, onTaille }: PaginationFooterProps) {
  const premier = (data.page - 1) * data.taille + 1;
  const dernier = premier + data.items.length - 1;

  return (
    <footer className="flex flex-col gap-4 border-t border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-content-secondary">
        <label className="flex items-center gap-3">
          Afficher
          <select value={data.taille} onChange={(e) => onTaille(Number(e.target.value))} className="input w-auto cursor-pointer py-2 pr-8">
            {TAILLES_PAGE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {element}s par page
        </label>
        <span aria-live="polite">
          {premier}–{dernier} sur {pluriel(data.total, element)}
        </span>
      </div>
      <Pagination page={data.page} totalPages={nombreDePages(data.total, data.taille)} onChange={onPage} />
    </footer>
  );
}
