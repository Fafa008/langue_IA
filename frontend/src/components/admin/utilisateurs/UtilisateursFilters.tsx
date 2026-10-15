import { UserRound } from "lucide-react";
import FilterSelect from "@/components/ui/FilterSelect";
import SearchField from "@/components/ui/SearchField";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import type { UtilisateursFiltres } from "@/types/utilisateur";

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

interface UtilisateursFiltersProps {
  filtres: UtilisateursFiltres;
  onChange: (changes: Partial<UtilisateursFiltres>) => void;
}

/** Recherche (lancée après une courte pause de frappe) et filtre par rôle. */
export default function UtilisateursFilters({ filtres, onChange }: UtilisateursFiltersProps) {
  return (
    <div role="search" className="card flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center">
      <div className="md:w-[26rem]">
        <SearchField label="Rechercher par nom ou e-mail" value={filtres.recherche} onSearch={(recherche) => onChange({ recherche })} />
      </div>
      <FilterSelect
        icon={UserRound}
        prefix="Rôle :"
        label="Filtrer par rôle"
        allLabel="Tous les rôles"
        value={filtres.role}
        options={ROLE_OPTIONS}
        onChange={(role) => onChange({ role })}
      />
    </div>
  );
}
