import { Ban, Pencil, RotateCcw } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ActionsLigne from "@/components/ui/ActionsLigne";
import { formatDateCourte } from "@/lib/date";
import type { Utilisateur } from "@/types/utilisateur";
import RoleBadge from "./RoleBadge";
import StatutBadge from "@/components/admin/StatutBadge";

const COLONNES = ["Utilisateur", "Rôle", "Statut", "Inscription"];

interface UtilisateursTableProps {
  utilisateurs: Utilisateur[];
  /** Administrateur connecté : il ne peut pas désactiver son propre compte. */
  idCourant: number | undefined;
  onModifier: (utilisateur: Utilisateur) => void;
  onChangerStatut: (utilisateur: Utilisateur) => void;
}

export default function UtilisateursTable({ utilisateurs, idCourant, onModifier, onChangerStatut }: UtilisateursTableProps) {
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
          {utilisateurs.map((u) => (
            <tr key={u.idUser} className="border-b border-border last:border-0 hover:bg-background/60">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar prenom={u.prenom} nom={u.nom} photoUrl={u.photoUrl} size={44} />
                  <div className="min-w-0">
                    <p className="whitespace-nowrap font-semibold text-content">
                      {u.prenom} {u.nom}
                    </p>
                    <p className="text-small text-content-secondary">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={u.role} />
              </td>
              <td className="px-4 py-3">
                <StatutBadge statut={u.statut} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-content">{formatDateCourte(u.dateInscription)}</td>
              <td className="px-4 py-3">
                <ActionsLigne
                  label={`Actions pour ${u.prenom} ${u.nom}`}
                  actions={[
                    { label: "Modifier", icon: Pencil, onSelect: () => onModifier(u) },
                    u.statut === "ACTIF"
                      ? {
                          label: "Désactiver",
                          icon: Ban,
                          danger: true,
                          onSelect: () => onChangerStatut(u),
                          disabled: u.idUser === idCourant,
                          title: "Vous ne pouvez pas désactiver votre propre compte.",
                        }
                      : { label: "Réactiver", icon: RotateCcw, onSelect: () => onChangerStatut(u) },
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
