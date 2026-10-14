import { Plus } from "lucide-react";
import SearchField from "@/components/ui/SearchField";
import type { LanguesFiltres } from "@/types/langue";

interface LanguesFiltersProps {
  filtres: LanguesFiltres;
  onChange: (changes: Partial<LanguesFiltres>) => void;
  onAjouter: () => void;
}

export default function LanguesFilters({ filtres, onChange, onAjouter }: LanguesFiltersProps) {
  return (
    <div className="card flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:flex-wrap md:items-center">
      <div role="search" className="md:min-w-[16rem] md:flex-1">
        <SearchField label="Rechercher une langue" value={filtres.recherche} onSearch={(recherche) => onChange({ recherche })} />
      </div>
      <button type="button" onClick={onAjouter} className="btn-primary whitespace-nowrap">
        <Plus size={18} aria-hidden />
        Ajouter une langue
      </button>
    </div>
  );
}
