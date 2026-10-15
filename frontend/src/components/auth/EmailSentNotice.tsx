import { Mail } from "lucide-react";
import Link from "next/link";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";

interface EmailSentNoticeProps {
  email: string;
  onResend: () => void;
  resending: boolean;
  error?: string;
}

export default function EmailSentNotice({ email, onResend, resending, error }: EmailSentNoticeProps) {
  return (
    <div className="text-center" role="status">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E3F0F0] text-success">
        <Mail size={28} aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold leading-tight md:text-2xl">Vérifiez votre boîte mail</h1>
      <p className="mt-1 text-content-secondary">
        Si un compte existe pour <strong className="text-content">{email}</strong>, un lien de réinitialisation
        vient d&apos;être envoyé. Il est valable 1 heure.
      </p>

      {error && <Alert className="mt-4 text-left">{error}</Alert>}

      <Button variant="secondary" fullWidth loading={resending} onClick={onResend} className="mt-6">
        Renvoyer l&apos;e-mail
      </Button>

      <Link href={ROUTES.login} className="mt-5 inline-block font-semibold text-primary hover:underline">
        ← Retour à la connexion
      </Link>
    </div>
  );
}
