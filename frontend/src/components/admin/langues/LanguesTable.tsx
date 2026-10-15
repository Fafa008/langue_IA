import { Pencil, Trash2 } from "lucide-react";
import ActionsLigne from "@/components/ui/ActionsLigne";
import { trierNiveaux } from "@/lib/niveaux";
import type { LangueAvecNiveaux } from "@/types/langue";
import LangueFlag from "./LangueFlag";

export type ActionLangue = "modifier" | "supprimer";

const COLONNES = ["Langue", "Code", "Niveaux"];

interface LanguesTableProps {
  langues: LangueAvecNiveaux[];
  onAction: (action: ActionLangue, langue: LangueAvecNiveaux) => void;
}

export default function LanguesTable({ langues, onAction }: LanguesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left">
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
          {langues.map((l) => (
            <tr key={l.idLangue} className="border-b border-border last:border-0 hover:bg-background/60">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <LangueFlag code={l.code} />
                  <span className="whitespace-nowrap font-medium text-content">{l.libelle}</span>
                </div>
              </td>
              <td className="px-5 py-4 text-content">{l.code.toUpperCase()}</td>
              <td className="px-5 py-4">
                {l.niveaux.length === 0 ? (
                  <span className="text-content-secondary">Aucun niveau</span>
                ) : (
                  <ul aria-label={`Niveaux de ${l.libelle}`} className="flex max-w-md flex-wrap gap-1.5">
                    {trierNiveaux(l.niveaux).map((n) => (
                      <li key={n.idNiveau} title={n.libelle} className="rounded-full bg-primary/5 px-2.5 py-0.5 text-small font-medium text-primary ring-1 ring-inset ring-primary/15">
                        {n.code}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-5 py-4">
                <ActionsLigne
                  label={`Actions pour ${l.libelle}`}
                  actions={[
                    { label: "Modifier", icon: Pencil, onSelect: () => onAction("modifier", l) },
                    { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => onAction("supprimer", l) },
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
