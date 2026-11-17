import { ArrowRight, CheckCircle2, CircleDot, Lock } from "lucide-react";
import Link from "next/link";
import BarreProgression from "@/components/pedagogie/testDiagnostic/resultat/BarreProgression";
import Badge from "@/components/ui/Badge";
import { progressionModule, STATUT_ETAPE_LABELS, statutModule } from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import type { ModuleParcours, StatutEtape } from "@/types/parcours-personnalise";

export const ICONES_ETAPE = { TERMINE: CheckCircle2, EN_COURS: CircleDot, A_VENIR: Lock } as const;

export function StatutEtapeBadge({ statut }: { statut: StatutEtape }) {
  return (
    <Badge
      tone={statut === "EN_COURS" ? "strong" : statut === "TERMINE" ? "soft" : "muted"}
      icon={ICONES_ETAPE[statut]}
      dot={statut === "TERMINE" ? "bg-success" : undefined}
    >
      {STATUT_ETAPE_LABELS[statut]}
    </Badge>
  );
}

/** Modules du parcours : chaque carte mène à la page du module et de ses leçons. */
export default function ListeModules({ modules, leconAtteinte }: { modules: ModuleParcours[]; leconAtteinte: number }) {
  return (
    <ol className="mt-4 grid gap-3 sm:grid-cols-2">
      {modules.map((module) => {
        const statut = statutModule(module, leconAtteinte);
        const progression = progressionModule(module, leconAtteinte);
        return (
          <li key={module.numero}>
            <Link
              href={ROUTES.apprenant.parcours.module(module.numero)}
              className={`card flex h-full flex-col gap-3 p-4 transition-shadow hover:border-primary/40 hover:shadow-lg ${
                statut === "EN_COURS" ? "border-primary/40" : ""
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="eyebrow">Module {module.numero}</span>
                  <span className="mt-1 block font-semibold text-content">{module.titre}</span>
                </span>
                <StatutEtapeBadge statut={statut} />
              </span>
              <span className="text-small text-content-secondary">{module.description}</span>
              <span className="mt-auto flex items-center gap-3 text-small">
                <span className="flex-1">
                  <BarreProgression label={`Progression du module ${module.numero}`} valeur={progression} />
                </span>
                <span className="tabular-nums text-content-secondary">
                  Leçons {module.premiereLecon}–{module.derniereLecon}
                </span>
                <ArrowRight size={16} className="text-primary" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
