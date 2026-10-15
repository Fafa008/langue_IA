"use client";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import PasswordInput from "@/components/ui/PasswordInput";
import { useResetPassword } from "@/hooks/useAuth";
import { useForm } from "@/hooks/useForm";
import { getErrorMessage } from "@/lib/api-client";
import { ROUTES } from "@/lib/routes";
import { validateResetPassword } from "@/lib/validation/auth";
import type { ResetPasswordFormValues } from "@/types/auth";
import AuthHeading from "./AuthHeading";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

const INITIAL_VALUES: ResetPasswordFormValues = { motDePasse: "", confirmation: "" };

const EXPIRED_LINK_MESSAGE = "Ce lien de réinitialisation est invalide ou a expiré.";

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const resetPassword = useResetPassword();
  const { values, errors, setField, handleSubmit } = useForm({
    initialValues: INITIAL_VALUES,
    validate: validateResetPassword,
    onSubmit: (v) => token && resetPassword.mutate({ token, motDePasse: v.motDePasse }),
  });

  if (!token) {
    return (
      <>
        <AuthHeading title="Lien invalide" subtitle={EXPIRED_LINK_MESSAGE} />
        <Link href={ROUTES.forgotPassword} className="btn-primary w-full">
          Demander un nouveau lien
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthHeading title="Nouveau mot de passe" subtitle="Choisissez un mot de passe sécurisé." />

      {resetPassword.isError && (
        <Alert>
          {getErrorMessage(resetPassword.error, { 400: EXPIRED_LINK_MESSAGE, 404: EXPIRED_LINK_MESSAGE })}{" "}
          <Link href={ROUTES.forgotPassword} className="underline">
            Demander un nouveau lien
          </Link>
        </Alert>
      )}

      <FormField
        id="password"
        label="Nouveau mot de passe"
        error={errors.motDePasse}
        hint={<PasswordStrengthMeter password={values.motDePasse} showRules />}
      >
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            placeholder="••••••••••"
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
            placeholder="••••••••••"
            value={values.confirmation}
            onChange={(e) => setField("confirmation", e.target.value)}
          />
        )}
      </FormField>

      <Button type="submit" fullWidth loading={resetPassword.isPending} className="mt-6">
        Réinitialiser le mot de passe
      </Button>
    </form>
  );
}
