import type { LucideIcon } from "lucide-react";

export interface Action {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Action irréversible ou bloquante (supprimer, désactiver) : survol en rouge. */
  danger?: boolean;
  disabled?: boolean;
  /** Explication affichée au survol d'une action désactivée. */
  title?: string;
}

interface ActionsLigneProps {
  /** Nom accessible du groupe : « Actions pour Jean DUPONT ». */
  label: string;
  actions: Action[];
}

/** Boutons d'action d'une ligne de tableau, affichés directement (peu d'actions par ligne). */
export default function ActionsLigne({ label, actions }: ActionsLigneProps) {
  return (
    <div role="group" aria-label={label} className="flex items-center justify-center gap-2">
      {actions.map(({ label: libelle, icon: Icon, onSelect, danger = false, disabled, title }) => (
        <button
          key={libelle}
          type="button"
          onClick={onSelect}
          disabled={disabled}
          title={disabled ? title : undefined}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-small font-medium text-content transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-content ${
            danger ? "hover:border-error/40 hover:text-error" : "hover:border-primary/40 hover:text-primary"
          }`}
        >
          <Icon size={16} aria-hidden />
          {libelle}
        </button>
      ))}
    </div>
  );
}
