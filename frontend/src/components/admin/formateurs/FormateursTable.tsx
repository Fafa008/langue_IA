import { Ban, Pencil, RotateCcw } from "lucide-react";
import StatutBadge from "@/components/admin/StatutBadge";
import ActionsLigne from "@/components/ui/ActionsLigne";
import Avatar from "@/components/ui/Avatar";
import { TYPE_CONTRAT_LABELS } from "@/lib/formateur";
import type { Formateur } from "@/types/formateur";

export type ActionFormateur = "modifier" | "statut";

const COLONNES = ["Formateur", "Langues enseignées", "Contrat", "Statut"];

interface FormateursTableProps {
  formateurs: Formateur[];
  onAction: (action: ActionFormateur, formateur: Formateur) => void;
}

export default function FormateursTable({ formateurs, onAction }: FormateursTableProps) {
  return (
    // Défilement horizontal du tableau seul sur petit écran
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left">
        <thead>
          <tr className="border-b border-border">
            {COLONNES.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-4 py-4 font-semibold text-content">
                {c}
              </th>
            ))}
            <th scope="col" className="px-4 py-4 text-center font-semibold text-content">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {formateurs.map((f) => {
            const nom = `${f.prenom} ${f.nom}`;
            return (
              <tr key={f.idUser} className="border-b border-border last:border-0 hover:bg-background/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar prenom={f.prenom} nom={f.nom} photoUrl={f.photoUrl} size={44} />
                    <div className="min-w-0">
                      <p className="whitespace-nowrap font-semibold text-content">{nom}</p>
                      <p className="text-small text-content-secondary">{f.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {f.languesEnseignees.length === 0 ? (
                    <span className="text-content-secondary">Aucune langue</span>
                  ) : (
                    <ul aria-label={`Langues enseignées par ${nom}`} className="flex max-w-xs flex-wrap gap-1.5">
                      {f.languesEnseignees.map((l) => (
                        <li key={l.idLangue} title={l.code.toUpperCase()} className="rounded-full bg-primary/5 px-2.5 py-0.5 text-small font-medium text-primary ring-1 ring-inset ring-primary/15">
                          {l.libelle}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-content">
                  {f.typeContrat ? TYPE_CONTRAT_LABELS[f.typeContrat] : <span className="text-content-secondary">Non renseigné</span>}
                </td>
                <td className="px-4 py-3">
                  <StatutBadge statut={f.statut} />
                </td>
                <td className="px-4 py-3">
                  <ActionsLigne
                    label={`Actions pour ${nom}`}
                    actions={[
                      { label: "Modifier", icon: Pencil, onSelect: () => onAction("modifier", f) },
                      f.statut === "ACTIF"
                        ? { label: "Désactiver", icon: Ban, danger: true, onSelect: () => onAction("statut", f) }
                        : { label: "Réactiver", icon: RotateCcw, onSelect: () => onAction("statut", f) },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
