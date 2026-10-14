import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  Globe,
  GraduationCap,
  House,
  Layers,
  LayoutDashboard,
  Presentation,
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
  /** Page pas encore développée : affichée « Bientôt », sans lien (évite une 404). */
  bientot?: true;
}

/** Page d'arrivée de chaque rôle après la connexion. */
export const ACCUEIL_PAR_ROLE: Record<Role, string> = {
  APPRENANT: ROUTES.apprenant.dashboard,
  FORMATEUR: ROUTES.formateur.dashboard,
  ADMINISTRATEUR: ROUTES.admin.dashboard,
};

const APPRENANT: NavItem[] = [
  { label: "Tableau de bord", href: ROUTES.apprenant.dashboard, icon: House },
  { label: "Mes cours", href: ROUTES.apprenant.mesCours, icon: BookOpen, bientot: true },
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
  { label: "Utilisateurs", href: ROUTES.admin.utilisateurs, icon: UsersRound, bientot: true },
  { label: "Ateliers", href: ROUTES.admin.ateliers, icon: CalendarDays, bientot: true },
  { label: "Réservations", href: ROUTES.admin.reservations, icon: CalendarCheck, bientot: true },
  { label: "Formations", href: ROUTES.admin.formations, icon: GraduationCap, bientot: true },
  { label: "Langues", href: ROUTES.admin.langues, icon: Globe, bientot: true },
  { label: "Niveaux", href: ROUTES.admin.niveaux, icon: Layers, bientot: true },
  { label: "Rapports", href: ROUTES.admin.rapports, icon: FileBarChart, bientot: true },
  { label: "Paramètres", href: ROUTES.admin.parametres, icon: Settings, bientot: true },
];

/** Menu latéral de l'espace connecté, selon le rôle. */
export const NAVIGATION: Record<Role, NavItem[]> = { APPRENANT, FORMATEUR, ADMINISTRATEUR };
