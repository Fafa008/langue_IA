"use client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useModifierUtilisateur } from "@/hooks/useModifierUtilisateur";
import { getErrorMessage } from "@/lib/api-client";
import type { Utilisateur } from "@/types/utilisateur";

interface ChangerStatutDialogProps {
  utilisateur: Utilisateur;
  onClose: () => void;
  onSaved: (utilisateur: Utilisateur) => void;
}

/** Confirmation avant de désactiver un compte actif, ou de réactiver un compte inactif ou suspendu. */
export default function ChangerStatutDialog({ utilisateur, onClose, onSaved }: ChangerStatutDialogProps) {
  const modifier = useModifierUtilisateur();
  const desactiver = utilisateur.statut === "ACTIF";
  const nom = <strong className="text-content">{`${utilisateur.prenom} ${utilisateur.nom}`}</strong>;

  return (
    <ConfirmDialog
      title={desactiver ? "Désactiver le compte ?" : "Réactiver le compte ?"}
      description={
        desactiver ? (
          <>{nom} ne pourra plus se connecter. Ses données sont conservées et le compte pourra être réactivé à tout moment.</>
        ) : (
          <>{nom} pourra de nouveau se connecter à la plateforme.</>
        )
      }
      confirmLabel={desactiver ? "Désactiver" : "Réactiver"}
      onConfirm={() =>
        modifier.mutate(
          { idUser: utilisateur.idUser, modification: { statut: desactiver ? "INACTIF" : "ACTIF" } },
          { onSuccess: onSaved },
        )
      }
      onClose={onClose}
      pending={modifier.isPending}
      error={modifier.isError ? getErrorMessage(modifier.error) : null}
    />
  );
}
