import type { ReactNode } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/** Gabarit minimal des pages informatives (conditions, confidentialité, FAQ). */
export default function PageStatique({
  eyebrow,
  titre,
  children,
}: {
  eyebrow: string;
  titre: string;
  children: ReactNode;
}) {
  return (
    <main className="container-page py-12">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2">{titre}</h1>
      <div className="card mt-8 max-w-3xl space-y-5 text-body leading-relaxed text-content-secondary">
        {children}
      </div>
      <p className="mt-6 text-small">
        <Link href={ROUTES.home} className="font-semibold text-primary hover:underline">
          ← Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
