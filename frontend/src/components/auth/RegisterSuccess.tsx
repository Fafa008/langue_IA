import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface RegisterSuccessProps {
  prenom: string;
  email: string;
}

export default function RegisterSuccess({ prenom, email }: RegisterSuccessProps) {
  return (
    <div className="text-center" role="status">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E3F0F0] text-success">
        <CheckCircle2 size={30} aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold leading-tight md:text-2xl">Bienvenue {prenom} !</h1>
      <p className="mt-1 text-content-secondary">
        Votre compte a bien été créé avec l&apos;adresse <strong className="text-content">{email}</strong>. Vous
        pouvez maintenant vous connecter.
      </p>

      <Link href={ROUTES.login} className="btn-primary mt-6 w-full">
        Se connecter
      </Link>
    </div>
  );
}
