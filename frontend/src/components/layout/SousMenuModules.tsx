"use client";

import { CheckCircle2, CircleDot, Lock } from "lucide-react";
import Link from "next/link";
import { useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { moduleDeLecon, STATUT_ETAPE_LABELS, statutModule } from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";

const ICONES = { TERMINE: CheckCircle2, EN_COURS: CircleDot, A_VENIR: Lock } as const;

/**
 * Sous-menu de « Mon parcours » : un lien par module (Module 1, Module 2…) vers la page de ses leçons.
 * Se déplie et se replie depuis la barre latérale ; rien n'est affiché tant que le parcours n'est pas chargé.
 */
export default function SousMenuModules({ pathname }: { pathname: string }) {
  const { data: parcours } = useParcoursPersonnalise();
  if (!parcours) return null;

  // Sur la page d'une leçon, son module est mis en évidence
  const prefixeLecon = `${ROUTES.apprenant.parcours.accueil}/lecons/`;
  const numeroLecon = pathname.startsWith(prefixeLecon) ? Number(pathname.slice(prefixeLecon.length)) : null;
  const moduleDeLaLecon = numeroLecon ? moduleDeLecon(parcours.modules, numeroLecon)?.numero : undefined;

  return (
    <ul id="sous-menu-modules" aria-label="Modules du parcours" className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
      {parcours.modules.map((module) => {
        const href = ROUTES.apprenant.parcours.module(module.numero);
        const actif = pathname === href || moduleDeLaLecon === module.numero;
        const statut = statutModule(module, parcours.leconAtteinte);
        const Icone = ICONES[statut];
        return (
          <li key={module.numero}>
            <Link
              href={href}
              aria-current={actif ? "page" : undefined}
              title={`${module.titre} (${STATUT_ETAPE_LABELS[statut].toLowerCase()})`}
              className={`flex items-center gap-2 rounded-btn px-2 py-2 text-small ${
                actif ? "bg-primary/10 font-semibold text-primary" : "text-content hover:bg-background hover:text-primary"
              }`}
            >
              <Icone
                size={14}
                aria-hidden
                className={`shrink-0 ${statut === "TERMINE" ? "text-success" : statut === "EN_COURS" ? "text-primary" : "text-content-secondary"}`}
              />
              <span className="truncate">
                Module {module.numero}
                <span className="sr-only">
                  {" "}
                  : {module.titre}, {STATUT_ETAPE_LABELS[statut].toLowerCase()}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
