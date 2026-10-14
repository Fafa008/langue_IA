"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import { ACCUEIL_PAR_ROLE, NAVIGATION } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";

const SOUS_TITRES = {
  APPRENANT: "Retrouvez vos cours, vos ateliers et vos inscriptions.",
  FORMATEUR: "Préparez vos séances et suivez vos apprenants.",
  ADMINISTRATEUR: "Pilotez les utilisateurs, les formations et l'activité du centre.",
};

/**
 * Accueil de l'espace connecté : un raccourci vers chaque rubrique du rôle.
 * Les rubriques pas encore développées sont affichées sans lien.
 */
export default function TableauDeBord() {
  const { utilisateur } = useSession();
  if (!utilisateur) return null;

  const rubriques = NAVIGATION[utilisateur.role].filter((item) => item.href !== ACCUEIL_PAR_ROLE[utilisateur.role]);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Espace {ROLE_LABELS[utilisateur.role].toLowerCase()}</p>
      <h1 className="mt-2">Bonjour {utilisateur.prenom}</h1>
      <p className="mt-1 text-base text-content-secondary">{SOUS_TITRES[utilisateur.role]}</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rubriques.map(({ label, href, icon: Icon, bientot }) => {
          const contenu = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary/10 text-primary">
                <Icon size={22} aria-hidden />
              </span>
              <span className="mt-4 flex items-center justify-between font-semibold text-content">
                <span>{label}</span>
                {bientot ? (
                  <span className="rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-semibold text-content-secondary">
                    Bientôt
                  </span>
                ) : (
                  <ArrowRight size={18} className="text-primary" aria-hidden />
                )}
              </span>
            </>
          );
          return (
            <li key={href}>
              {bientot ? (
                <div aria-disabled className="card flex h-full flex-col opacity-70">
                  {contenu}
                </div>
              ) : (
                <Link href={href} className="card flex h-full flex-col transition-shadow hover:border-primary/40 hover:shadow-lg">
                  {contenu}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
