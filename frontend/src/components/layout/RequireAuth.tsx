"use client";
import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/hooks/useSession";
import { ACCUEIL_PAR_ROLE } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import type { Role } from "@/types/utilisateur";

interface RequireAuthProps {
  /** Rôles autorisés ; absent : tout utilisateur connecté. */
  roles?: Role[];
  children: ReactNode;
}

/**
 * Réservé aux utilisateurs connectés (sinon redirection vers la connexion) et, si `roles` est donné,
 * aux rôles indiqués. Ce contrôle n'est qu'un confort d'affichage : l'API vérifie les droits.
 */
export default function RequireAuth({ roles, children }: RequireAuthProps) {
  const router = useRouter();
  const { ready, isAuthenticated, utilisateur } = useSession();

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace(ROUTES.login);
  }, [ready, isAuthenticated, router]);

  if (!isAuthenticated || !utilisateur) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-content-secondary">
        <Loader2 className="animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  if (roles && !roles.includes(utilisateur.role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <ShieldAlert size={40} className="text-primary" aria-hidden />
        <h1 className="mt-4 text-h3 text-primary md:text-h3">Accès réservé</h1>
        <p className="mt-2 text-content-secondary">Vous n&apos;avez pas les droits nécessaires pour afficher cette page.</p>
        <Link href={ACCUEIL_PAR_ROLE[utilisateur.role]} className="btn-secondary mt-6">
          Retour à mon espace
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
