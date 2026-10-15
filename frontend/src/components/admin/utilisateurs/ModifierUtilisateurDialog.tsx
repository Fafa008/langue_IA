"use client";
import { Mail, Phone, UserRound } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import FormField from "@/components/ui/FormField";
import IconInput from "@/components/ui/IconInput";
import Select from "@/components/ui/Select";
import { useForm } from "@/hooks/useForm";
import { useModifierUtilisateur } from "@/hooks/useModifierUtilisateur";
import { ApiError, HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import { formatEmail, formatNom, formatPrenom, formatTelephone, normaliserEmail, normaliserEspaces } from "@/lib/saisie";
import { validateUtilisateur } from "@/lib/validation/profil";
import type { ModificationUtilisateur, Role, Utilisateur, UtilisateurFormValues } from "@/types/utilisateur";

const ERREURS = {
  [HTTP_STATUS.CONFLICT]: "Cette adresse e-mail est déjà utilisée par un autre compte.",
};

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

const toFormValues = (u: Utilisateur): UtilisateurFormValues => ({
  prenom: u.prenom,
  nom: u.nom,
  email: u.email,
  telephone: formatTelephone(u.telephone ?? ""),
  role: u.role,
});

const toModification = (v: UtilisateurFormValues): ModificationUtilisateur => ({
  prenom: normaliserEspaces(v.prenom),
  nom: normaliserEspaces(v.nom),
  email: normaliserEmail(v.email),
  telephone: normaliserEspaces(v.telephone) || null,
  role: v.role,
});

interface ModifierUtilisateurDialogProps {
  utilisateur: Utilisateur;
  /** L'administrateur connecté ne peut pas changer son propre rôle (il perdrait l'accès). */
  estSoiMeme: boolean;
  onClose: () => void;
  onSaved: (utilisateur: Utilisateur) => void;
}

export default function ModifierUtilisateurDialog({ utilisateur, estSoiMeme, onClose, onSaved }: ModifierUtilisateurDialogProps) {
  const modifier = useModifierUtilisateur();
  const form = useForm({
    initialValues: toFormValues(utilisateur),
    validate: validateUtilisateur,
    onSubmit: (v) =>
      modifier.mutate({ idUser: utilisateur.idUser, modification: toModification(v) }, { onSuccess: onSaved }),
  });
  const { values, errors, handleSubmit } = form;

  /** Toute modification efface l'erreur renvoyée par le serveur. */
  const setField: typeof form.setField = (name, value) => {
    if (modifier.isError) modifier.reset();
    form.setField(name, value);
  };

  const emailPris = modifier.error instanceof ApiError && modifier.error.status === HTTP_STATUS.CONFLICT;

  return (
    <Dialog
      title="Modifier l'utilisateur"
      onClose={onClose}
      locked={modifier.isPending}
    >
      <form onSubmit={handleSubmit} noValidate>
        {modifier.isError && <Alert className="mt-4">{getErrorMessage(modifier.error, ERREURS)}</Alert>}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField id="edit-prenom" label="Prénom *" error={errors.prenom}>
            {(field) => (
              <IconInput {...field} icon={UserRound} format={formatPrenom} value={values.prenom} onChange={(e) => setField("prenom", e.target.value)} />
            )}
          </FormField>
          <FormField id="edit-nom" label="Nom *" error={errors.nom}>
            {(field) => (
              <IconInput {...field} icon={UserRound} format={formatNom} value={values.nom} onChange={(e) => setField("nom", e.target.value)} />
            )}
          </FormField>
        </div>

        <FormField id="edit-email" label="Adresse e-mail *" error={errors.email}>
          {({ invalid, ...field }) => (
            <IconInput
              {...field}
              icon={Mail}
              invalid={invalid || emailPris}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              format={formatEmail}
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          )}
        </FormField>

        <FormField id="edit-telephone" label="Téléphone" error={errors.telephone}>
          {(field) => (
            <IconInput
              {...field}
              icon={Phone}
              type="tel"
              inputMode="numeric"
              placeholder="030 00 000 00"
              format={formatTelephone}
              value={values.telephone}
              onChange={(e) => setField("telephone", e.target.value)}
            />
          )}
        </FormField>

        <FormField
          id="edit-role"
          label="Rôle"
          hint={estSoiMeme ? "Vous ne pouvez pas modifier votre propre rôle." : undefined}
        >
          {(field) => (
            <Select
              {...field}
              options={ROLE_OPTIONS}
              disabled={estSoiMeme}
              value={values.role}
              onChange={(e) => setField("role", e.target.value as Role)}
            />
          )}
        </FormField>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={modifier.isPending}>
            Annuler
          </Button>
          <Button type="submit" loading={modifier.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
