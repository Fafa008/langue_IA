import { GraduationCap, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/types/utilisateur";

/** Les rôles se distinguent par leur icône et l'intensité de la couleur principale. */
const STYLES: Record<Role, { icon: LucideIcon; tone: "soft" | "medium" | "strong" }> = {
  APPRENANT: { icon: UserRound, tone: "soft" },
  FORMATEUR: { icon: GraduationCap, tone: "medium" },
  ADMINISTRATEUR: { icon: ShieldCheck, tone: "strong" },
};

export default function RoleBadge({ role }: { role: Role }) {
  const { icon, tone } = STYLES[role];
  return (
    <Badge tone={tone} icon={icon}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}
