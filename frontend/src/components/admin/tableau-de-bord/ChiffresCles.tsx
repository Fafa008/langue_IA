import { CalendarDays, GraduationCap, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import type { TotauxPlateforme } from "@/types/tableau-de-bord";
import { Squelette } from "./CarteSection";

const nombre = new Intl.NumberFormat("fr-FR");

interface Indicateur {
  cle: keyof TotauxPlateforme;
  label: string;
  icon: LucideIcon;
  /** Liste détaillée correspondante ; absente tant que la rubrique n'existe pas. */
  href?: string;
}

const INDICATEURS: Indicateur[] = [
  { cle: "utilisateurs", label: "Utilisateurs", icon: UsersRound, href: ROUTES.admin.utilisateurs },
  { cle: "apprenants", label: "Apprenants", icon: GraduationCap, href: `${ROUTES.admin.utilisateurs}?role=APPRENANT` },
  { cle: "formateurs", label: "Formateurs", icon: UserRound, href: `${ROUTES.admin.utilisateurs}?role=FORMATEUR` },
  { cle: "ateliersProgrammes", label: "Ateliers programmés", icon: CalendarDays },
];

/** Quatre chiffres clés ; chaque carte mène à la liste correspondante quand elle existe. */
export default function ChiffresCles({ totaux }: { totaux: TotauxPlateforme | undefined }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {INDICATEURS.map(({ cle, label, icon: Icon, href }) => {
        const contenu = (
          <>
            <span className="flex h-10 w-10 shrink-0 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon size={24} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-content-secondary">{label}</span>
              {totaux ? (
                <span className="mt-1 block text-[1.5rem] font-bold leading-8 sm:text-[1.75rem] sm:leading-9 text-primary">{nombre.format(totaux[cle])}</span>
              ) : (
                <Squelette className="mt-1 h-9 w-16" />
              )}
            </span>
          </>
        );
        // Sur mobile : deux cartes par ligne, icône au-dessus du chiffre
        const classes = "card flex h-full flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6";
        return (
          <li key={cle}>
            {href ? (
              <Link href={href} className={`${classes} transition-shadow hover:border-primary/40 hover:shadow-lg`}>
                {contenu}
              </Link>
            ) : (
              <div className={classes}>{contenu}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
