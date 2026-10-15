"use client";
import { Globe, Layers } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";

const ONGLETS = [
  { label: "Langues", href: ROUTES.admin.langues, icon: Globe },
  { label: "Niveaux", href: ROUTES.admin.niveaux, icon: Layers },
];

export default function OngletsLanguesNiveaux() {
  const pathname = usePathname();
  return (
    <nav aria-label="Langues et niveaux" className="mb-6 border-b border-border">
      <ul className="-mb-px flex gap-2">
        {ONGLETS.map(({ label, href, icon: Icon }) => {
          const actif = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold ${
                  actif ? "border-primary text-primary" : "border-transparent text-content-secondary hover:border-border hover:text-primary"
                }`}
              >
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
