"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImageLogo } from "@/components/ui/Logo";
import { useSession } from "@/hooks/useSession";
import { CITATION } from "@/lib/marque";
import { estActif, NAVIGATION } from "@/lib/navigation";
import SousMenuModules from "./SousMenuModules";

/** Navigation de l'espace connecté, selon le rôle (écrans larges ; sur mobile, le menu du compte la remplace). */
export default function AppSidebar() {
  const pathname = usePathname();
  const { utilisateur, isAuthenticated } = useSession();
  const items = isAuthenticated && utilisateur ? NAVIGATION[utilisateur.role] : [];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-8 lg:flex">
      <nav aria-label="Espace personnel" className="flex flex-col gap-1.5">
        {items.map((item) => {
          const { label, href, icon: Icon, bientot, sousPages } = item;
          const active = estActif(item, pathname);
          // Rubrique à sous-pages (Mon parcours) : ses modules s'affichent quand on est dans la rubrique
          const ouverte = sousPages && active;
          if (bientot) {
            return (
              <span key={href} aria-disabled className="flex cursor-default items-center gap-4 rounded-btn px-3 py-3 font-medium text-content-secondary">
                <Icon size={22} strokeWidth={1.75} className="shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
                <span className="ml-auto shrink-0 rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-semibold">Bientôt</span>
              </span>
            );
          }
          return (
            <div key={href}>
              <Link
                href={href}
                aria-current={pathname === href || item.aussiActifSur?.includes(pathname) ? "page" : active ? "true" : undefined}
                className={`flex items-center gap-4 rounded-btn px-3 py-3 font-medium ${
                  active ? "bg-primary/10 text-primary" : "text-content hover:bg-background hover:text-primary"
                }`}
              >
                <Icon size={22} strokeWidth={1.75} className="shrink-0" aria-hidden />
                {label}
              </Link>
              {ouverte && <SousMenuModules pathname={pathname} />}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto rounded-card bg-primary/5 p-5 text-small text-content">
        <ImageLogo className="h-10 w-10" />
        <p className="mt-3 font-medium leading-snug">{CITATION}</p>
      </div>
    </aside>
  );
}
