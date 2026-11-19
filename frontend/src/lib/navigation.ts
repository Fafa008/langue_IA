import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  Globe,
  GraduationCap,
  House,
  LayoutDashboard,
  MessageSquare,
  Presentation,
  Route,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import type { Role } from "@/types/utilisateur";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Page pas encore développée : affichée sans lien (évite une 404), avec « Bientôt » ou le libellé indiqué. */
  bientot?: true;
  /** Libellé de l'état quand il n'est pas « Bientôt » (décision D6 : « À venir »). */
  libelleEtat?: string;
  /** Autres pages où l'entrée est aussi mise en évidence (onglets d'une même page). */
  aussiActifSur?: string[];
  /** L'entrée reste en évidence sur les pages rangées sous son adresse (modules et leçons du parcours). */
  sousPages?: true;
}

/** Vrai si l'entrée du menu correspond à la page affichée. */
export function estActif({ href, aussiActifSur, sousPages }: NavItem, pathname: string): boolean {
  return pathname === href || !!aussiActifSur?.includes(pathname) || (!!sousPages && pathname.startsWith(`${href}/`));
}

/** Page d'arrivée de chaque rôle après la connexion. */
export const ACCUEIL_PAR_ROLE: Record<Role, string> = {
  APPRENANT: ROUTES.apprenant.dashboard,
  FORMATEUR: ROUTES.formateur.dashboard,
  ADMINISTRATEUR: ROUTES.admin.dashboard,
};

const APPRENANT: NavItem[] = [
  { label: "Tableau de bord", href: ROUTES.apprenant.dashboard, icon: House },
  { label: "Test de positionnement", href: ROUTES.apprenant.testDiagnostic.demarrage, icon: ClipboardList },
  { label: "Mon parcours", href: ROUTES.apprenant.parcours.accueil, icon: Route, sousPages: true },
  { label: "Professeur IA", href: ROUTES.apprenant.chat, icon: MessageSquare, bientot: true, libelleEtat: "À venir" },
  { label: "Ateliers", href: ROUTES.apprenant.ateliers, icon: CalendarDays, bientot: true },
  { label: "Mon profil", href: ROUTES.profil, icon: UserRound },
  { label: "Mes inscriptions", href: ROUTES.apprenant.mesInscriptions, icon: ClipboardList, bientot: true },
  { label: "Paramètres", href: ROUTES.apprenant.parametres, icon: Settings, bientot: true },
];

const FORMATEUR: NavItem[] = [
  { label: "Tableau de bord", href: ROUTES.formateur.dashboard, icon: House },
  { label: "Mes séances", href: ROUTES.formateur.seances, icon: Presentation, bientot: true },
  { label: "Ateliers", href: ROUTES.formateur.ateliers, icon: CalendarDays, bientot: true },
  { label: "Mes apprenants", href: ROUTES.formateur.apprenants, icon: UsersRound, bientot: true },
  { label: "Mon profil", href: ROUTES.profil, icon: UserRound },
  { label: "Paramètres", href: ROUTES.formateur.parametres, icon: Settings, bientot: true },
];

const ADMINISTRATEUR: NavItem[] = [
  { label: "Tableau de bord", href: ROUTES.admin.dashboard, icon: LayoutDashboard },
  { label: "Utilisateurs", href: ROUTES.admin.utilisateurs, icon: UsersRound },
  { label: "Formateurs", href: ROUTES.admin.formateurs, icon: Presentation },
  { label: "Ateliers", href: ROUTES.admin.ateliers, icon: CalendarDays, bientot: true },
  { label: "Réservations", href: ROUTES.admin.reservations, icon: CalendarCheck, bientot: true },
  { label: "Formations", href: ROUTES.admin.formations, icon: GraduationCap, bientot: true },
  { label: "Langues et niveaux", href: ROUTES.admin.langues, icon: Globe, aussiActifSur: [ROUTES.admin.niveaux] },
  { label: "Rapports", href: ROUTES.admin.rapports, icon: FileBarChart, bientot: true },
  { label: "Paramètres", href: ROUTES.admin.parametres, icon: Settings, bientot: true },
];

/** Menu latéral de l'espace connecté, selon le rôle. */
export const NAVIGATION: Record<Role, NavItem[]> = { APPRENANT, FORMATEUR, ADMINISTRATEUR };
