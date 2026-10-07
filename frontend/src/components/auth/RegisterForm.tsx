"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { useRegister } from "@/hooks/useAuth";
import { useForm } from "@/hooks/useForm";
import { useFormules } from "@/hooks/useFormules";
import { getErrorMessage } from "@/lib/api-client";
import { formatEmail, formatNom, formatPrenom, normaliserEspaces } from "@/lib/saisie";
import { ROUTES } from "@/lib/routes";
import { validateRegister } from "@/lib/validation/auth";
import type { RegisterFormValues, RegisterPayload } from "@/types/auth";
import AuthHeading from "./AuthHeading";
import FormulePicker from "./FormulePicker";
import LanguePicker from "./LanguePicker";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import RegisterSuccess from "./RegisterSuccess";

const INITIAL_VALUES: RegisterFormValues = {
  prenom: "",
  nom: "",
  email: "",
  dateNaissance: "",
  langues: [],
  idFormule: null,
  motDePasse: "",
  confirmation: "",
  accepteConditions: false,
};

/** Valeurs du formulaire (déjà validées) → données envoyées à l'API. */
function toPayload(v: RegisterFormValues): RegisterPayload {
  return {
    prenom: normaliserEspaces(v.prenom),
    nom: normaliserEspaces(v.nom),
    email: v.email.trim().toLowerCase(),
    motDePasse: v.motDePasse,
    dateNaissance: v.dateNaissance,
    langues: v.langues,
    idFormule: v.idFormule as number,
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first-of-type:mt-0">
      <legend className="eyebrow">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Date du jour au format AAAA-MM-JJ, en heure locale (toISOString() renvoie la date UTC). */
function today(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export default function RegisterForm() {
  const register = useRegister();
  const { data: formules = [] } = useFormules();
  const form = useForm({
    initialValues: INITIAL_VALUES,
    validate: (v) => validateRegister(v, formules),
    onSubmit: (v) => register.mutate(toPayload(v)),
  });
  const { values, errors, handleSubmit } = form;

  /** Toute modification efface l'erreur renvoyée par le serveur (ex. e-mail déjà utilisé). */
  const setField: typeof form.setField = (name, value) => {
    if (register.isError) register.reset();
    form.setField(name, value);
  };

  if (register.isSuccess) {
    return (
      <RegisterSuccess prenom={register.data.prenom} email={register.data.email} />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthHeading title="Créez votre compte" subtitle="Quelques minutes suffisent pour commencer." />

      {register.isError && (
        <Alert className="mb-4">
          {getErrorMessage(register.error, { 409: "Un compte existe déjà avec cette adresse e-mail." })}
        </Alert>
      )}

      <Section title="Vos informations">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <FormField id="prenom" label="Prénom" error={errors.prenom}>
            {(field) => (
              <Input
                {...field}
                autoComplete="given-name"
                placeholder="Prénom"
                format={formatPrenom}
                value={values.prenom}
                onChange={(e) => setField("prenom", e.target.value)}
              />
            )}
          </FormField>
          <FormField id="nom" label="Nom" error={errors.nom}>
            {(field) => (
              <Input
                {...field}
                autoComplete="family-name"
                placeholder="NOM"
                format={formatNom}
                value={values.nom}
                onChange={(e) => setField("nom", e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField id="email" label="Adresse e-mail" error={errors.email}>
          {(field) => (
            <Input
              {...field}
              // type="text" + inputMode : clavier e-mail sur mobile, et le curseur peut être
              // replacé après la mise en forme (impossible avec type="email")
              type="text"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="email"
              placeholder="prenom@exemple.com"
              format={formatEmail}
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          )}
        </FormField>

        <FormField id="dateNaissance" label="Date de naissance" error={errors.dateNaissance}>
          {(field) => (
            <Input
              {...field}
              type="date"
              autoComplete="bday"
              max={today()}
              value={values.dateNaissance}
              onChange={(e) => setField("dateNaissance", e.target.value)}
            />
          )}
        </FormField>
      </Section>

      <Section title="Votre apprentissage">
        <LanguePicker value={values.langues} onChange={(v) => setField("langues", v)} error={errors.langues} />
        <FormulePicker value={values.idFormule} onChange={(v) => setField("idFormule", v)} error={errors.idFormule} />
      </Section>

      <Section title="Sécurité">
        <FormField
          id="motDePasse"
          label="Mot de passe"
          error={errors.motDePasse}
          hint={<PasswordStrengthMeter password={values.motDePasse} />}
        >
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              placeholder="••••••••"
              value={values.motDePasse}
              onChange={(e) => setField("motDePasse", e.target.value)}
            />
          )}
        </FormField>

        <FormField id="confirmation" label="Confirmer le mot de passe" error={errors.confirmation}>
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              placeholder="••••••••"
              value={values.confirmation}
              onChange={(e) => setField("confirmation", e.target.value)}
            />
          )}
        </FormField>
      </Section>

      <Checkbox
        id="accepteConditions"
        className="mt-5"
        error={errors.accepteConditions}
        checked={values.accepteConditions}
        onChange={(e) => setField("accepteConditions", e.target.checked)}
        label={
          <>
            J&apos;accepte les{" "}
            <Link href={ROUTES.terms} className="font-semibold text-primary hover:underline">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href={ROUTES.privacy} className="font-semibold text-primary hover:underline">
              politique de confidentialité
            </Link>
            .
          </>
        }
      />

      <Button type="submit" fullWidth loading={register.isPending} className="mt-6">
        Créer mon compte
      </Button>

      <p className="mt-5 text-center text-content-secondary">
        Déjà inscrit ?{" "}
        <Link href={ROUTES.login} className="font-semibold text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
