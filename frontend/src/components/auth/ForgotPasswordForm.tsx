"use client";
import { useState } from "react";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import { useForgotPassword } from "@/hooks/useAuth";
import { useForm } from "@/hooks/useForm";
import { getErrorMessage } from "@/lib/api-client";
import { ROUTES } from "@/lib/routes";
import { validateForgotPassword } from "@/lib/validation/auth";
import AuthHeading from "./AuthHeading";
import EmailSentNotice from "./EmailSentNotice";

export default function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  // E-mail auquel le lien a été envoyé : bascule vers l'écran « Vérifiez votre boîte mail »
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = (email: string) => forgotPassword.mutate({ email }, { onSuccess: () => setSentTo(email) });

  const { values, errors, setField, handleSubmit } = useForm({
    initialValues: { email: "" },
    validate: validateForgotPassword,
    onSubmit: (v) => send(v.email.trim()),
  });

  if (sentTo) {
    return (
      <EmailSentNotice
        email={sentTo}
        resending={forgotPassword.isPending}
        error={forgotPassword.isError ? getErrorMessage(forgotPassword.error) : undefined}
        onResend={() => send(sentTo)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthHeading
        title="Mot de passe oublié ?"
        subtitle="Saisissez votre e-mail : un lien vous sera envoyé pour le réinitialiser."
      />

      {forgotPassword.isError && <Alert>{getErrorMessage(forgotPassword.error)}</Alert>}

      <FormField id="email" label="Adresse e-mail" error={errors.email}>
        {(field) => (
          <Input
            {...field}
            type="email"
            autoComplete="email"
            placeholder="prenom@exemple.com"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        )}
      </FormField>

      <Button type="submit" fullWidth loading={forgotPassword.isPending} className="mt-6">
        Envoyer le lien
      </Button>

      <p className="mt-5 text-center">
        <Link href={ROUTES.login} className="font-semibold text-primary hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
