import { ChevronDown, type LucideIcon } from "lucide-react";

interface FilterSelectProps<V extends string> {
  icon: LucideIcon;
  /** Préfixe visible : « Rôle : ». */
  prefix: string;
  /** Nom accessible : « Filtrer par rôle ». */
  label: string;
  /** Libellé du choix « aucun filtre » : « Tous les rôles ». */
  allLabel: string;
  value: V | null;
  options: { value: V; label: string }[];
  onChange: (value: V | null) => void;
}

/** Liste déroulante de filtre, précédée d'une icône et d'un préfixe (« Rôle : Tous les rôles »). */
export default function FilterSelect<V extends string>({ icon: Icon, prefix, label, allLabel, value, options, onChange }: FilterSelectProps<V>) {
  return (
    <label className="relative flex items-center rounded-btn border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary md:w-64">
      <Icon size={20} className="pointer-events-none absolute left-4 text-content" aria-hidden />
      <span className="pointer-events-none absolute left-12 text-content-secondary">{prefix}</span>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as V | null)}
        style={{ paddingLeft: `calc(3rem + ${prefix.length * 0.5}rem)` }}
        className="w-full cursor-pointer appearance-none rounded-btn bg-transparent py-3 pr-10 text-body text-content focus:outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3 text-primary" aria-hidden />
    </label>
  );
}
