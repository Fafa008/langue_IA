import Link from "next/link";
import type { ReactNode } from "react";
import AuthSidePanel from "@/components/auth/AuthSidePanel";
import Logo from "@/components/ui/Logo";
import { ROUTES } from "@/lib/routes";

/** Gabarit partagé par les écrans d'authentification (inscription, connexion…). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.1fr_0.9fr]">
      <main className="flex flex-col px-4 py-6 sm:px-9 sm:py-7">
        <Logo />
        <div className="mx-auto my-10 flex w-full max-w-sm flex-1 flex-col justify-center">{children}</div>
        <Link href={ROUTES.home} className="text-[0.8125rem] text-content-secondary hover:text-primary">
          ← Retour à l&apos;accueil
        </Link>
      </main>
      <AuthSidePanel />
    </div>
  );
}
