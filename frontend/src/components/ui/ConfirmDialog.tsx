"use client";
import type { ReactNode } from "react";
import Alert from "./Alert";
import Button from "./Button";
import Dialog from "./Dialog";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  /** Message d'erreur à afficher (ex. refus du serveur). */
  error?: string | null;
}

/** Demande de confirmation avant une action (désactiver, supprimer…). */
export default function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose, pending = false, error }: ConfirmDialogProps) {
  return (
    <Dialog title={title} description={description} onClose={onClose} locked={pending}>
      {error && <Alert className="mt-4">{error}</Alert>}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="button" onClick={onConfirm} loading={pending} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
