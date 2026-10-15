"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import UserMenu from "@/components/UserMenu";
import { useSession } from "@/hooks/useSession";
import { ROUTES } from "@/lib/routes";

// Ancres de la page d'accueil : préfixées par « / » pour fonctionner depuis les autres pages
const links = [
  { label: "Accueil", href: "/" },
  { label: "À propos", href: "/#apropos" },
  { label: "Langues", href: "/#langues" },
  { label: "Parcours", href: "/#ateliers" },
  { label: "Contact", href: "/#contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { ready, utilisateur, isAuthenticated } = useSession();
  const connected = isAuthenticated && utilisateur !== null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={`py-2 text-body font-medium ${
                l.href === pathname
                  ? "border-b-2 border-primary text-primary"
                  : "text-content hover:text-primary"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {connected && <UserMenu utilisateur={utilisateur} />}
          {/* Rien avant la lecture de la session, pour ne pas afficher brièvement les boutons de connexion */}
          {ready && !connected && (
            <div className="hidden items-center gap-3 lg:flex">
              <Link href={ROUTES.login} className="btn-secondary">Se connecter</Link>
              <Link href={ROUTES.register} className="btn-primary">S&apos;inscrire</Link>
            </div>
          )}

          <button
            className="lg:hidden"
            aria-label="Menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav className="container-page flex flex-col gap-4 py-4">
            {links.map((l) => (
              <Link key={l.label} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            {ready && !connected && (
              <>
                <Link href={ROUTES.login} className="btn-secondary">Se connecter</Link>
                <Link href={ROUTES.register} className="btn-primary">S&apos;inscrire</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
