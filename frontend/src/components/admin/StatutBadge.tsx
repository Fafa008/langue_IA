import Badge from "@/components/ui/Badge";
import { STATUT_LABELS } from "@/lib/roles";
import type { StatutUtilisateur } from "@/types/utilisateur";

/** Statut d'un compte utilisateur. */
const STYLES: Record<StatutUtilisateur, { tone: "soft" | "muted"; dot: string }> = {
  ACTIF: { tone: "soft", dot: "bg-primary" },
  INACTIF: { tone: "muted", dot: "bg-content-secondary" },
  SUSPENDU: { tone: "muted", dot: "border-2 border-content-secondary bg-transparent" },
};

export default function StatutBadge({ statut }: { statut: StatutUtilisateur }) {
  const { tone, dot } = STYLES[statut];
  return (
    <Badge tone={tone} dot={dot}>
      {STATUT_LABELS[statut]}
    </Badge>
  );
}
