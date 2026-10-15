import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface CarteSectionProps {
  titre: string;
  icon: LucideIcon;
  /** Lien ou contrôle aligné à droite du titre. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Carte du tableau de bord : titre avec icône, action facultative, puis le contenu. */
export default function CarteSection({ titre, icon: Icon, action, className = "", children }: CarteSectionProps) {
  const id = `carte-${titre.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`card flex flex-col p-0 ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 id={id} className="flex items-center gap-3 text-h4 font-semibold text-content">
          <Icon size={20} className="shrink-0 text-primary" aria-hidden />
          {titre}
        </h2>
        {action}
      </header>
      <div className="flex-1 p-6">{children}</div>
    </section>
  );
}

/** Bloc grisé animé affiché pendant le chargement. */
export function Squelette({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-btn bg-background ${className}`} />;
}
