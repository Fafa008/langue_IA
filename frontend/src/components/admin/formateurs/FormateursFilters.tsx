import { CircleDot, Plus } from "lucide-react";
import FilterSelect from "@/components/ui/FilterSelect";
import SearchField from "@/components/ui/SearchField";
import { STATUT_LABELS, STATUTS } from "@/lib/roles";
import type { FormateursFiltres } from "@/types/formateur";

const STATUT_OPTIONS = STATUTS.map((statut) => ({ value: statut, label: STATUT_LABELS[statut] }));

interface FormateursFiltersProps {
  filtres: FormateursFiltres;
  onChange: (changes: Partial<FormateursFiltres>) => void;
  onAjouter: () => void;
}

/** Recherche, filtre par statut et bouton d'ajout. */
export default function FormateursFilters({ filtres, onChange, onAjouter }: FormateursFiltersProps) {
  return (
    <div className="card flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:flex-wrap md:items-center">
      <div role="search" className="flex flex-col gap-3 md:flex-1 md:flex-row md:items-center">
        <div className="md:min-w-[16rem] md:flex-1">
          <SearchField label="Rechercher un formateur" value={filtres.recherche} onSearch={(recherche) => onChange({ recherche })} />
        </div>
        <FilterSelect
          icon={CircleDot}
          prefix="Statut :"
          label="Filtrer par statut"
          allLabel="Tous les statuts"
          value={filtres.statut}
          options={STATUT_OPTIONS}
          onChange={(statut) => onChange({ statut })}
        />
      </div>
      <button type="button" onClick={onAjouter} className="btn-primary whitespace-nowrap">
        <Plus size={18} aria-hidden />
        Ajouter un formateur
      </button>
    </div>
  );
}
