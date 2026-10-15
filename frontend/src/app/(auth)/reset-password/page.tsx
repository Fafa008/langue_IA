import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Nouveau mot de passe – La Digithèque" };

/** Atteinte via le lien envoyé par e-mail : /reset-password?token=… */
export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return <ResetPasswordForm token={searchParams.token ?? null} />;
}
