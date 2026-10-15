"use client";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { useLogout } from "@/hooks/useAuth";
import { useDismiss } from "@/hooks/useDismiss";
import { ACCUEIL_PAR_ROLE } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { ROLE_LABELS } from "@/lib/roles";
import type { Utilisateur } from "@/types/utilisateur";

/** Avatar de l'utilisateur connecté (à droite de l'en-tête) et son menu déroulant. */
export default function UserMenu({ utilisateur }: { utilisateur: Utilisateur }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useLogout();

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
        className="flex items-center gap-3 rounded-full p-1 pr-2 transition-colors hover:bg-background"
      >
        <Avatar prenom={utilisateur.prenom} nom={utilisateur.nom} photoUrl={utilisateur.photoUrl} size={44} />
        <span className="hidden font-medium text-content sm:inline">{utilisateur.prenom}</span>
        <ChevronDown size={18} className={`text-content transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
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
          <Link
            role="menuitem"
            href={ACCUEIL_PAR_ROLE[utilisateur.role]}
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-3 px-4 py-2.5 text-content hover:bg-background hover:text-primary"
          >
            <LayoutDashboard size={18} aria-hidden />
            Mon espace
          </Link>
          <Link
            role="menuitem"
            href={ROUTES.profil}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-content hover:bg-background hover:text-primary"
          >
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
