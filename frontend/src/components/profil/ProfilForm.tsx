"use client";
import { Info, Lock, Mail, Phone, Save, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import IconInput from "@/components/ui/IconInput";
import PasswordInput from "@/components/ui/PasswordInput";
import { useForm } from "@/hooks/useForm";
import { useUpdateProfil } from "@/hooks/useProfil";
import { ApiError, HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { formatEmail, formatNom, formatPrenom, formatTelephone, normaliserEmail, normaliserEspaces } from "@/lib/saisie";
import { validateProfil } from "@/lib/validation/profil";
import type { ProfilFormValues, ProfilPayload } from "@/types/profil";
import type { Utilisateur } from "@/types/utilisateur";

const MOT_DE_PASSE_ACTUEL_INCORRECT = "Le mot de passe actuel est incorrect.";

const PROFIL_ERRORS = {
  [HTTP_STATUS.BAD_REQUEST]: MOT_DE_PASSE_ACTUEL_INCORRECT,
  [HTTP_STATUS.CONFLICT]: "Cette adresse e-mail est déjà utilisée par un autre compte.",
};

/** Données du serveur → valeurs du formulaire (mot de passe vide = inchangé). */
const toFormValues = (u: Utilisateur): ProfilFormValues => ({
  prenom: u.prenom,
  nom: u.nom,
  email: u.email,
  telephone: formatTelephone(u.telephone ?? ""),
  motDePasseActuel: "",
  motDePasse: "",
  confirmation: "",
});

/** Valeurs saisies (déjà validées) → données envoyées à l'API. */
const toPayload = (v: ProfilFormValues): ProfilPayload => ({
  prenom: normaliserEspaces(v.prenom),
  nom: normaliserEspaces(v.nom),
  email: normaliserEmail(v.email),
  // Champ vidé : le numéro est retiré (null), comme la colonne Utilisateur.telephone
  telephone: normaliserEspaces(v.telephone) || null,
  ...(v.motDePasse ? { motDePasse: v.motDePasse, motDePasseActuel: v.motDePasseActuel } : {}),
});

/** Libellé d'un champ obligatoire : « Prénom * ». */
const required = (label: string) => `${label} *`;

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-h3 text-primary">{children}</h2>;
}

/*(section Sécurité). */
function LockedLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Lock size={18} aria-hidden />
      {children}
    </span>
  );
}

interface ProfilFormProps {
  utilisateur: Utilisateur;
  onSaved: () => void;
}

export default function ProfilForm({ utilisateur, onSaved }: ProfilFormProps) {
  const update = useUpdateProfil();
  const form = useForm({
    initialValues: toFormValues(utilisateur),
    validate: validateProfil,
    onSubmit: (v) =>
      update.mutate(toPayload(v), {
        onSuccess: (saved) => {
          // Le formulaire reprend les valeurs enregistrées et vide les mots de passe
          form.reset(toFormValues(saved));
          onSaved();
        },
      }),
  });
  const { values, errors, handleSubmit } = form;

  /** Toute modification efface l'erreur renvoyée par le serveur. */
  const setField: typeof form.setField = (name, value) => {
    if (update.isError) update.reset();
    form.setField(name, value);
  };

  function cancel() {
    update.reset();
    form.reset(toFormValues(utilisateur));
  }

  const emailTaken = update.error instanceof ApiError && update.error.status === HTTP_STATUS.CONFLICT;
  const motDePasseActuelRefuse = update.error instanceof ApiError && update.error.status === HTTP_STATUS.BAD_REQUEST;

  return (
    <form onSubmit={handleSubmit} noValidate className="md:pl-8" aria-label="Modifier mon profil">
      <SectionTitle>Informations personnelles</SectionTitle>

      {update.isError && !motDePasseActuelRefuse && (
        <Alert className="mt-4">{getErrorMessage(update.error, PROFIL_ERRORS)}</Alert>
      )}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormField id="prenom" label={required("Prénom")} error={errors.prenom}>
          {(field) => (
            <IconInput
              {...field}
              icon={UserRound}
              autoComplete="given-name"
              format={formatPrenom}
              value={values.prenom}
              onChange={(e) => setField("prenom", e.target.value)}
            />
          )}
        </FormField>
        <FormField id="nom" label={required("Nom")} error={errors.nom}>
          {(field) => (
            <IconInput
              {...field}
              icon={UserRound}
              autoComplete="family-name"
              format={formatNom}
              value={values.nom}
              onChange={(e) => setField("nom", e.target.value)}
            />
          )}
        </FormField>
      </div>

      <FormField id="email" label={required("Adresse e-mail")} error={errors.email}>
        {({ invalid, ...field }) => (
          <IconInput
            {...field}
            icon={Mail}
            invalid={invalid || emailTaken}
            type="text"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="email"
            format={formatEmail}
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        )}
      </FormField>

      <FormField id="telephone" label="Téléphone" error={errors.telephone}>
        {(field) => (
          <IconInput
            {...field}
            icon={Phone}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="030 00 000 00"
            format={formatTelephone}
            value={values.telephone}
            onChange={(e) => setField("telephone", e.target.value)}
          />
        )}
      </FormField>

      <hr className="my-8 border-border" />

      <SectionTitle>Sécurité</SectionTitle>
      <p className="mt-1 text-small text-content-secondary">
        Pour changer de mot de passe, saisissez d&apos;abord l&apos;actuel. Laissez ces champs vides pour le conserver.
      </p>

      <FormField
        id="motDePasseActuel"
        label={<LockedLabel>Mot de passe actuel</LockedLabel>}
        error={errors.motDePasseActuel ?? (motDePasseActuelRefuse ? MOT_DE_PASSE_ACTUEL_INCORRECT : undefined)}
      >
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="current-password"
            value={values.motDePasseActuel}
            onChange={(e) => setField("motDePasseActuel", e.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="motDePasse"
        label={<LockedLabel>Nouveau mot de passe</LockedLabel>}
        error={errors.motDePasse}
        hint={`${PASSWORD_MIN_LENGTH} caractères minimum, avec une majuscule, une minuscule et un chiffre`}
      >
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            value={values.motDePasse}
            onChange={(e) => setField("motDePasse", e.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="confirmation"
        label={<LockedLabel>Confirmer le nouveau mot de passe</LockedLabel>}
        error={errors.confirmation}
      >
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            value={values.confirmation}
            onChange={(e) => setField("confirmation", e.target.value)}
          />
        )}
      </FormField>

      <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={cancel} disabled={update.isPending} className="sm:min-w-32">
          Annuler
        </Button>
        <Button type="submit" loading={update.isPending} className="sm:min-w-36">
          {!update.isPending && <Save size={18} aria-hidden />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
