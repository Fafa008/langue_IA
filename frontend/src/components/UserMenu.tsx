"use client";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { useLogout } from "@/hooks/useAuth";
import { useDismiss } from "@/hooks/useDismiss";
import { ACCUEIL_PAR_ROLE, NAVIGATION } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { ROLE_LABELS } from "@/lib/roles";
import type { Utilisateur } from "@/types/utilisateur";

const ITEM = "flex items-center gap-3 px-4 py-2.5 text-content hover:bg-background hover:text-primary";

/**
 * Avatar de l'utilisateur connecté (à droite de l'en-tête) et son menu déroulant.
 * Sur mobile, le menu reprend aussi les rubriques de l'espace (la navigation latérale y est masquée).
 */
export default function UserMenu({ utilisateur }: { utilisateur: Utilisateur }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const pathname = usePathname();
  const fermer = () => setOpen(false);
  // « Mon espace » et « Mon profil » sont déjà proposés plus bas
  const rubriques = NAVIGATION[utilisateur.role].filter(
    ({ href, bientot }) => !bientot && href !== ACCUEIL_PAR_ROLE[utilisateur.role] && href !== ROUTES.profil,
  );

  const refs = useRef([ref]).current;
  useDismiss(open, refs, useCallback(() => setOpen(false), []));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className="flex items-center gap-1 rounded-full p-1 transition-colors hover:bg-background"
      >
        <Avatar prenom={utilisateur.prenom} nom={utilisateur.nom} photoUrl={utilisateur.photoUrl} size={44} />
        <ChevronDown size={16} className={`text-content transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-btn border border-border bg-surface py-2 shadow-card">
          <div className="border-b border-border px-4 pb-2">
            <p className="truncate font-semibold text-content">
              {utilisateur.prenom} {utilisateur.nom}
            </p>
            <p className="truncate text-small text-content-secondary">
              {ROLE_LABELS[utilisateur.role]} · {utilisateur.email}
            </p>
          </div>
          {rubriques.length > 0 && (
            <div className="border-b border-border py-1 lg:hidden">
              {rubriques.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  role="menuitem"
                  href={href}
                  onClick={fermer}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`${ITEM} ${pathname === href ? "font-semibold text-primary" : ""}`}
                >
                  <Icon size={18} aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          )}
          <Link role="menuitem" href={ACCUEIL_PAR_ROLE[utilisateur.role]} onClick={fermer} className={`mt-1 ${ITEM}`}>
            <LayoutDashboard size={18} aria-hidden />
            Mon espace
          </Link>
          <Link role="menuitem" href={ROUTES.profil} onClick={fermer} className={ITEM}>
            <UserRound size={18} aria-hidden />
            Mon profil
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-content hover:bg-background hover:text-error"
          >
            <LogOut size={18} aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
