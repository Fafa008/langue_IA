"use client";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { useLogin } from "@/hooks/useAuth";
import { useForm } from "@/hooks/useForm";
import { ApiError, HTTP_STATUS, getErrorMessage } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { ROUTES } from "@/lib/routes";
import { formatEmail, normaliserEmail } from "@/lib/saisie";
import { validateLogin } from "@/lib/validation/auth";
import type { LoginFormValues } from "@/types/auth";
import AuthHeading from "./AuthHeading";
import ComptesDemo from "./ComptesDemo";

const INITIAL_VALUES: LoginFormValues = { email: "", motDePasse: "", seSouvenir: true };

const LOGIN_ERRORS = {
  [HTTP_STATUS.UNAUTHORIZED]: "E-mail ou mot de passe incorrect.",
  [HTTP_STATUS.FORBIDDEN]: "Votre compte est inactif ou suspendu. Contactez l'accueil de La Digithèque pour le réactiver.",
};

/** Valeurs saisies (déjà validées) → identifiants envoyés à l'API. */
const toCredentials = (v: LoginFormValues): LoginFormValues => ({ ...v, email: normaliserEmail(v.email) });

interface LoginFormProps {
  passwordReset?: boolean;
}

export default function LoginForm({ passwordReset = false }: LoginFormProps) {
  const login = useLogin();
  const form = useForm({
    initialValues: INITIAL_VALUES,
    validate: validateLogin,
    onSubmit: (v) => login.mutate(toCredentials(v)),
  });
  const { values, errors, handleSubmit } = form;

  function choisirCompteDemo(email: string, motDePasse: string) {
    login.reset();
    form.reset({ ...values, email, motDePasse });
  }

  /** Toute modification efface l'erreur renvoyée par le serveur. */
  const setField: typeof form.setField = (name, value) => {
    if (login.isError) login.reset();
    form.setField(name, value);
  };

  // Seul un refus des identifiants met les champs en erreur (pas une panne serveur ni un compte inactif)
  const credentialsRejected = login.error instanceof ApiError && login.error.status === HTTP_STATUS.UNAUTHORIZED;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthHeading title="Bon retour parmi nous" subtitle="Connectez-vous pour reprendre votre apprentissage." />

      {passwordReset && !login.isError && (
        <Alert variant="success">Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.</Alert>
      )}
      {login.isError && <Alert>{getErrorMessage(login.error, LOGIN_ERRORS)}</Alert>}

      <FormField id="email" label="Adresse e-mail" error={errors.email}>
        {({ invalid, ...field }) => (
          <Input
            {...field}
            invalid={invalid || credentialsRejected}
            // Même champ qu'à l'inscription : clavier e-mail sur mobile, minuscules automatiques
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

      <FormField id="password" label="Mot de passe" error={errors.motDePasse}>
        {({ invalid, ...field }) => (
          <PasswordInput
            {...field}
            invalid={invalid || credentialsRejected}
            autoComplete="current-password"
            placeholder="••••••••"
            value={values.motDePasse}
            onChange={(e) => setField("motDePasse", e.target.value)}
          />
        )}
      </FormField>

      <div className="mt-4 flex items-center justify-between gap-4">
        <Checkbox
          id="remember"
          label="Se souvenir de moi"
          checked={values.seSouvenir}
          onChange={(e) => setField("seSouvenir", e.target.checked)}
        />
        <Link href={ROUTES.forgotPassword} className="text-[0.8125rem] font-semibold text-primary hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>

      {/* Reste en chargement pendant la redirection qui suit la connexion */}
      <Button type="submit" fullWidth loading={login.isPending || login.isSuccess} className="mt-6">
        Se connecter
      </Button>

      <p className="mt-5 text-center text-content-secondary">
        Pas encore de compte ?{" "}
        <Link href={ROUTES.register} className="font-semibold text-primary hover:underline">
          S&apos;inscrire
        </Link>
      </p>

      {API_MOCK && <ComptesDemo onChoisir={choisirCompteDemo} />}
    </form>
  );
}
