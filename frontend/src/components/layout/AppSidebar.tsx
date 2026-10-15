"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { NAVIGATION } from "@/lib/navigation";

/** Navigation de l'espace connecté, selon le rôle (écrans larges ; sur mobile, le menu du compte la remplace). */
export default function AppSidebar() {
  const pathname = usePathname();
  const { utilisateur, isAuthenticated } = useSession();
  const items = isAuthenticated && utilisateur ? NAVIGATION[utilisateur.role] : [];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-8 lg:flex">
      <nav aria-label="Espace personnel" className="flex flex-col gap-1.5">
        {items.map(({ label, href, icon: Icon, bientot, aussiActifSur }) => {
          const active = pathname === href || !!aussiActifSur?.includes(pathname);
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
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-4 rounded-btn px-3 py-3 font-medium ${
                active ? "bg-primary/10 text-primary" : "text-content hover:bg-background hover:text-primary"
              }`}
            >
              <Icon size={22} strokeWidth={1.75} className="shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-card bg-primary/5 p-5 text-small text-content-secondary">
        <Image src="/logo.jpg" alt="" width={40} height={40} className="mb-3 h-10 w-10 rounded-lg shadow-card" />
        Apprendre aujourd&apos;hui, réussir demain.
      </div>
    </aside>
  );
}
