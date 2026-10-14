import { Pencil, Trash2 } from "lucide-react";
import ActionsLigne from "@/components/ui/ActionsLigne";
import type { Niveau } from "@/types/langue";

export type ActionNiveau = "modifier" | "supprimer";

const COLONNES = ["Code", "Libellé"];

interface NiveauxTableProps {
  niveaux: Niveau[];
  onAction: (action: ActionNiveau, niveau: Niveau) => void;
}

export default function NiveauxTable({ niveaux, onAction }: NiveauxTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left">
        <thead>
          <tr className="border-b border-border">
            {COLONNES.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold text-content">
                {c}
              </th>
            ))}
            <th scope="col" className="px-5 py-4 text-center font-semibold text-content">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {niveaux.map((n) => (
            <tr key={n.idNiveau} className="border-b border-border last:border-0 hover:bg-background/60">
              <td className="whitespace-nowrap px-5 py-4 font-semibold text-content">{n.code}</td>
              <td className="px-5 py-4 text-content">{n.libelle}</td>
              <td className="px-5 py-4">
                <ActionsLigne
                  label={`Actions pour ${n.code}`}
                  actions={[
                    { label: "Modifier", icon: Pencil, onSelect: () => onAction("modifier", n) },
                    { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => onAction("supprimer", n) },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
