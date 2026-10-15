import type { Abonnement, StatutAbonnement } from "@/types/abonnement";
import type { LangueGeree } from "@/types/langue";
import type { InscriptionApprenant, InscriptionsDuJour, PeriodeInscriptions, StatistiquesAdmin } from "@/types/tableau-de-bord";
import { delay } from "./delay";
import { FORMULES_MOCK } from "./formules.mock";

/* Statistiques simulées du tableau de bord administrateur. */

const LANGUES: Record<string, LangueGeree> = {
  fr: { idLangue: 1, code: "fr", libelle: "Français" },
  en: { idLangue: 2, code: "en", libelle: "Anglais" },
  zh: { idLangue: 3, code: "zh", libelle: "Mandarin" },
  it: { idLangue: 4, code: "it", libelle: "Italien" },
  de: { idLangue: 5, code: "de", libelle: "Allemand" },
};

const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000);

function abonnement(idFormule: number, statut: StatutAbonnement, joursAvant: number): Abonnement {
  const formule = FORMULES_MOCK.find((f) => f.idFormule === idFormule)!;
  const debut = ilYA(joursAvant);
  const fin = new Date(debut);
  fin.setMonth(fin.getMonth() + formule.dureeMois);
  return {
    idAbonnement: 500 + idFormule + joursAvant,
    dateDebut: debut.toISOString().slice(0, 10),
    dateFin: fin.toISOString().slice(0, 10),
    statut,
    quotaHeures: formule.quotaHeures,
    quotaAteliers: formule.quotaAteliers,
    formule,
  };
}

function inscription(
  idUser: number,
  prenom: string,
  nom: string,
  codes: string[],
  souscription: Abonnement | null,
  joursAvant: number,
): InscriptionApprenant {
  return {
    apprenant: {
      idUser,
      prenom,
      nom,
      email: `${prenom}.${nom}@exemple.com`.toLowerCase(),
      telephone: null,
      role: "APPRENANT",
      statut: "ACTIF",
      dateInscription: ilYA(joursAvant).toISOString(),
      photoUrl: null,
      dateNaissance: null,
      pays: null,
      ville: null,
      objectif: null,
    },
    langues: codes.map((c) => LANGUES[c]),
    abonnement: souscription,
  };
}

const STATISTIQUES: StatistiquesAdmin = {
  totaux: { utilisateurs: 248, apprenants: 186, formateurs: 42, ateliersProgrammes: 18 },
  apprenantsParLangue: [
    { langue: LANGUES.fr, apprenants: 71 },
    { langue: LANGUES.en, apprenants: 48 },
    { langue: LANGUES.zh, apprenants: 28 },
    { langue: LANGUES.it, apprenants: 22 },
    { langue: LANGUES.de, apprenants: 17 },
  ],
  dernieresInscriptions: [
    inscription(301, "Jean", "Dupont", ["fr"], abonnement(1, "ACTIF", 0), 0),
    inscription(300, "Marie", "Paul", ["en", "fr"], abonnement(3, "ACTIF", 1), 1),
    inscription(299, "Paul", "Rakoto", ["zh"], null, 3),
    inscription(298, "Lova", "Ramirisoa", ["it"], abonnement(2, "SUSPENDU", 6), 6),
    inscription(297, "Tiana", "Andriamihaja", ["de", "en", "zh"], abonnement(3, "ACTIF", 8), 8),
  ],
};

/** Courbe régulière et reproductible : une tendance à la hausse avec de petites variations. */
function inscriptionsSimulees(jours: number): InscriptionsDuJour[] {
  const aujourdhui = new Date();
  return Array.from({ length: jours }, (_, i) => {
    const date = new Date(aujourdhui);
    date.setDate(aujourdhui.getDate() - (jours - 1 - i));
    const n = date.getDate();
    return {
      date: date.toISOString().slice(0, 10),
      nombre: Math.max(0, Math.round(4 + (i / jours) * 6 + 3 * Math.sin(n / 2) + (n % 3))),
    };
  });
}

export const tableauDeBordMock = {
  async consulterStatistiques(): Promise<StatistiquesAdmin> {
    await delay(400);
    return STATISTIQUES;
  },

  async inscriptions(jours: PeriodeInscriptions): Promise<InscriptionsDuJour[]> {
    await delay(300);
    return inscriptionsSimulees(jours);
  },
};
