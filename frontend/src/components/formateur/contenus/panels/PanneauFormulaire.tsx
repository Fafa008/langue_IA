"use client";
import { Save, type LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import SidePanel from "@/components/ui/SidePanel";
import { useEnregistrerContenu } from "@/hooks/useContenus";
import { useForm } from "@/hooks/useForm";
import { ErreurContenus } from "@/lib/contenus/service";
import type { ContenusLangue, Entite, EntitesParType, SaisiesParType, TypeEntite } from "@/lib/contenus/types";
import type { Validator } from "@/types/form";

/** Props communes aux quatre formulaires (module, leçon, activité, parcours). */
export interface PanneauProps<E extends Entite> {
  /** Tous les contenus de la langue : listes de choix et règles (unicité, publication…). */
  ctx: ContenusLangue;
  /** null : création. */
  existant: E | null;
  onClose: () => void;
  onSaved: (entite: E) => void;
}

/**
 * État d'un formulaire de contenu : validation locale (validation.ts), puis création ou modification par le service.
 * Toute saisie efface l'erreur renvoyée par le service.
 */
export function useFormulaireContenu<T extends TypeEntite>(
  type: T,
  { ctx, existant, onSaved }: PanneauProps<EntitesParType[T]>,
  initialValues: SaisiesParType[T],
  validate: Validator<SaisiesParType[T]>,
) {
  const enregistrer = useEnregistrerContenu(type, ctx.langue.code);
  const form = useForm<SaisiesParType[T]>({
    initialValues,
    validate,
    onSubmit: (saisie) => enregistrer.mutate({ id: existant?.id, saisie }, { onSuccess: (e) => onSaved(e as EntitesParType[T]) }),
    submitting: enregistrer.isPending,
  });

  const setField: typeof form.setField = (name, value) => {
    if (enregistrer.isError) enregistrer.reset();
    form.setField(name, value);
  };

  return { ...form, setField, pending: enregistrer.isPending, erreur: enregistrer.error };
}

/** Message d'un refus du service (règle non respectée) ou d'une erreur inattendue. */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurContenus) {
    const champs = Object.values(erreur.champs);
    return champs.length > 0 ? `${erreur.message} ${champs.join(" ")}` : erreur.message;
  }
  return "L'enregistrement a échoué. Réessayez.";
}

interface PanneauFormulaireProps {
  titre: string;
  icon: LucideIcon;
  /** Nom accessible du formulaire. */
  label: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  erreur: unknown;
  children: ReactNode;
}

/** Panneau latéral (même modèle que « Ajouter une langue ») : champs, erreur du service, Annuler / Enregistrer. */
export default function PanneauFormulaire({ titre, icon, label, onClose, onSubmit, pending, erreur, children }: PanneauFormulaireProps) {
  return (
    <SidePanel title={titre} icon={icon} onClose={onClose} locked={pending}>
      <form onSubmit={onSubmit} noValidate aria-label={label}>
        {erreur != null && <Alert className="mt-2">{messageErreur(erreur)}</Alert>}
        {children}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {!pending && <Save size={18} aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
