import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* Nuances de la couleur principale uniquement : le vert et le rouge sont réservés aux messages. */
const TONES = {
  soft: "bg-primary/5 text-primary ring-primary/15",
  medium: "bg-primary/10 text-primary ring-primary/25",
  strong: "bg-primary text-white ring-primary",
  muted: "bg-background text-content-secondary ring-border",
};

interface BadgeProps {
  tone?: keyof typeof TONES;
  icon?: LucideIcon;
  /** Pastille ronde avant le texte (statuts). */
  dot?: string;
  children: ReactNode;
}

export default function Badge({ tone = "soft", icon: Icon, dot, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-small font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {Icon && <Icon size={14} aria-hidden />}
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />}
      {children}
    </span>
  );
}
