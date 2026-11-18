import { BookOpen, CheckCircle2, Circle, Headphones, Languages, Mic, RotateCcw, SpellCheck, type LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { STATUT_EXERCICE_LABELS, TYPE_EXERCICE_LABELS } from "@/lib/parcours-personnalise";
import type { ExerciceParcours, StatutExercice, TypeExercice } from "@/types/parcours-personnalise";

export const ICONES_TYPE: Record<TypeExercice, LucideIcon> = {
  GRAMMAIRE: SpellCheck,
  VOCABULAIRE: Languages,
  COMPREHENSION: BookOpen,
  ECOUTE: Headphones,
  ORAL: Mic,
};

/** Le statut est toujours écrit en toutes lettres : l'icône et la pastille de couleur ne font que le renforcer. */
const STYLE_STATUT: Record<StatutExercice, { icone: LucideIcon; tone: "soft" | "muted"; dot?: string }> = {
  A_FAIRE: { icone: Circle, tone: "muted" },
  REUSSI: { icone: CheckCircle2, tone: "soft", dot: "bg-success" },
  A_REVOIR: { icone: RotateCcw, tone: "soft", dot: "bg-warning" },
};

export function StatutExerciceBadge({ statut, score }: { statut: StatutExercice; score: number | null }) {
  const { icone, tone, dot } = STYLE_STATUT[statut];
  return (
    <Badge tone={tone} icon={icone} dot={dot}>
      {STATUT_EXERCICE_LABELS[statut]}
      {score !== null && <span className="font-normal">· {score}/100</span>}
    </Badge>
  );
}

/** Un exercice du parcours : type, intitulé, difficulté et statut. */
export default function LigneExercice({ exercice }: { exercice: ExerciceParcours }) {
  const Icone = ICONES_TYPE[exercice.type];
  const type = TYPE_EXERCICE_LABELS[exercice.type];
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary/10 text-primary">
        <Icone size={20} />
      </span>
      <span className="min-w-0 flex-1 basis-40">
        <span className="block font-semibold text-content">{exercice.intitule ?? type}</span>
        <span className="text-small text-content-secondary">
          {type} · Difficulté {exercice.difficulte}/5
        </span>
      </span>
      <StatutExerciceBadge statut={exercice.statut} score={exercice.scoreObtenu} />
    </li>
  );
}
