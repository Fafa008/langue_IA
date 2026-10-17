import { configureApiClient } from "@/lib/api-client";
import { httpFormateursService } from "@/services/formateurs.service";
import { httpLanguesService } from "@/services/langues.service";
import { httpNiveauxService } from "@/services/niveaux.service";
import { httpTableauDeBordService } from "@/services/tableau-de-bord.service";
import { httpUtilisateursService } from "@/services/utilisateurs.service";
import { fetchCall, mockFetch } from "@/test/fetch-mock";

/*
 * Contrat avec le backend (docs/api/contrat-frontend.md) : chaque service appelle la bonne route,
 * envoie les champs en snake_case et convertit la réponse vers les types du frontend.
 */

const API = "http://localhost:8000/api/v1";

const UTILISATEUR_DTO = {
  id_user: 7,
  nom: "RAKOTO",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: "+261 34 12 345 67",
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2025-01-12T10:00:00Z",
};

const UTILISATEUR = {
  idUser: 7,
  nom: "RAKOTO",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: "+261 34 12 345 67",
  role: "APPRENANT",
  statut: "ACTIF",
  dateInscription: "2025-01-12T10:00:00Z",
  photoUrl: null,
};

beforeEach(() => {
  configureApiClient({ getToken: () => "jwt-123", onUnauthorized: jest.fn() });
});

describe("utilisateursService", () => {
  it("lister : GET /users avec pagination, recherche et rôle", async () => {
    const fetchMock = mockFetch({ body: { items: [UTILISATEUR_DTO], total: 31, page: 2, page_size: 10 } });

    const page = await httpUtilisateursService.lister({ recherche: " rova ", role: "APPRENANT", page: 2, taille: 10 });

    expect(fetchCall(fetchMock).url).toBe(`${API}/users?page=2&page_size=10&search=rova&role=APPRENANT`);
    expect(page).toEqual({ items: [UTILISATEUR], total: 31, page: 2, taille: 10 });
  });

  it("lister : sans recherche ni rôle, seuls les paramètres de pagination sont envoyés", async () => {
    const fetchMock = mockFetch({ body: { items: [], total: 0, page: 1, page_size: 20 } });
    await httpUtilisateursService.lister({ recherche: "", role: null, page: 1, taille: 20 });
    expect(fetchCall(fetchMock).url).toBe(`${API}/users?page=1&page_size=20`);
  });
});

describe("utilisateursService.modifier", () => {
  it("PATCH /users/{id} avec les seuls champs fournis", async () => {
    const fetchMock = mockFetch({ body: { ...UTILISATEUR_DTO, role: "FORMATEUR" } });

    const modifie = await httpUtilisateursService.modifier(7, { prenom: "Rova", role: "FORMATEUR", telephone: null, email: undefined });

    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/users/7`, "PATCH"]);
    expect(body).toEqual({ prenom: "Rova", role: "FORMATEUR", telephone: null });
    expect(modifie.role).toBe("FORMATEUR");
  });

  it("désactive un compte avec { statut: INACTIF }", async () => {
    const fetchMock = mockFetch({ body: { ...UTILISATEUR_DTO, statut: "INACTIF" } });
    await expect(httpUtilisateursService.modifier(7, { statut: "INACTIF" })).resolves.toMatchObject({ statut: "INACTIF" });
    expect(fetchCall(fetchMock).body).toEqual({ statut: "INACTIF" });
  });
});

describe("languesService", () => {
  // Association LangueNiveau : chaque langue arrive avec ses niveaux ouverts
  const LANGUE_DTO = { id_langue: 3, code: "zh", libelle: "Mandarin", niveaux: [{ id_niveau: 7, code: "HSK 1", libelle: "Débutant" }] };
  const LANGUE = { idLangue: 3, code: "zh", libelle: "Mandarin", niveaux: [{ idNiveau: 7, code: "HSK 1", libelle: "Débutant" }] };

  it("lister : GET /langues avec pagination et recherche, niveaux compris", async () => {
    const fetchMock = mockFetch({ body: { items: [LANGUE_DTO], total: 12, page: 1, page_size: 10 } });
    await expect(httpLanguesService.lister({ recherche: "man", page: 1, taille: 10 })).resolves.toEqual({
      items: [LANGUE],
      total: 12,
      page: 1,
      taille: 10,
    });
    expect(fetchCall(fetchMock).url).toBe(`${API}/langues?page=1&page_size=10&search=man`);
  });

  it("creer : POST /langues avec les niveaux ouverts (id_niveaux)", async () => {
    const fetchMock = mockFetch({ status: 201, body: LANGUE_DTO });
    await expect(httpLanguesService.creer({ code: "zh", libelle: "Mandarin", idNiveaux: [7] })).resolves.toEqual(LANGUE);
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/langues`, "POST"]);
    expect(body).toEqual({ code: "zh", libelle: "Mandarin", id_niveaux: [7] });
  });

  it("modifier : PATCH /langues/{id} remplace la liste des niveaux", async () => {
    const fetchMock = mockFetch({ body: { ...LANGUE_DTO, niveaux: [] } });
    await expect(httpLanguesService.modifier(3, { idNiveaux: [] })).resolves.toMatchObject({ niveaux: [] });
    expect(fetchCall(fetchMock).body).toEqual({ id_niveaux: [] });
  });

  it("modifier : PATCH /langues/{id} avec les seuls champs fournis", async () => {
    const fetchMock = mockFetch({ body: { ...LANGUE_DTO, libelle: "Chinois" } });
    await expect(httpLanguesService.modifier(3, { libelle: "Chinois", code: undefined })).resolves.toMatchObject({ libelle: "Chinois" });
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method, body]).toEqual([`${API}/langues/3`, "PATCH", { libelle: "Chinois" }]);
  });

  it("supprimer : DELETE /langues/{id}", async () => {
    const fetchMock = mockFetch({ status: 204 });
    await httpLanguesService.supprimer(3);
    const { url, init } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/langues/3`, "DELETE"]);
  });
});

describe("formateursService", () => {
  // Utilisateur de rôle FORMATEUR + table Formateur + langues enseignées (FormateurLangue)
  const FORMATEUR_DTO = {
    ...UTILISATEUR_DTO,
    role: "FORMATEUR",
    type_contrat: "CDD",
    certifications: null,
    langues_enseignees: [
      { id_langue: 3, code: "zh", libelle: "Mandarin" },
      { id_langue: 2, code: "en", libelle: "Anglais" },
    ],
  };
  const FORMATEUR = {
    ...UTILISATEUR,
    role: "FORMATEUR",
    typeContrat: "CDD",
    certifications: null,
    // Triées par désignation
    languesEnseignees: [
      { idLangue: 2, code: "en", libelle: "Anglais" },
      { idLangue: 3, code: "zh", libelle: "Mandarin" },
    ],
  };

  it("lister : GET /formateurs avec pagination, recherche et statut", async () => {
    const fetchMock = mockFetch({ body: { items: [FORMATEUR_DTO], total: 12, page: 2, page_size: 10 } });
    await expect(httpFormateursService.lister({ recherche: " rova ", statut: "INACTIF", page: 2, taille: 10 })).resolves.toEqual({
      items: [FORMATEUR],
      total: 12,
      page: 2,
      taille: 10,
    });
    expect(fetchCall(fetchMock).url).toBe(`${API}/formateurs?page=2&page_size=10&search=rova&statut=INACTIF`);
  });

  it("lister : un type de contrat inconnu est ramené à null", async () => {
    mockFetch({ body: { items: [{ ...FORMATEUR_DTO, type_contrat: "Stage" }], total: 1, page: 1, page_size: 10 } });
    const { items } = await httpFormateursService.lister({ recherche: "", statut: null, page: 1, taille: 10 });
    expect(items[0].typeContrat).toBeNull();
  });

  it("creer : POST /formateurs en snake_case, langues par identifiant (id_langues)", async () => {
    const fetchMock = mockFetch({ status: 201, body: FORMATEUR_DTO });
    await expect(
      httpFormateursService.creer({
        prenom: "Rova",
        nom: "RAKOTO",
        email: "rova@exemple.com",
        telephone: null,
        typeContrat: "CDD",
        certifications: null,
        idLangues: [3, 2],
      }),
    ).resolves.toEqual(FORMATEUR);
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/formateurs`, "POST"]);
    expect(body).toEqual({
      prenom: "Rova",
      nom: "RAKOTO",
      email: "rova@exemple.com",
      telephone: null,
      type_contrat: "CDD",
      certifications: null,
      id_langues: [3, 2],
    });
  });

  it("modifier : PATCH /formateurs/{id} avec les seuls champs fournis (désactivation)", async () => {
    const fetchMock = mockFetch({ body: { ...FORMATEUR_DTO, statut: "INACTIF" } });
    await expect(httpFormateursService.modifier(7, { statut: "INACTIF" })).resolves.toMatchObject({ statut: "INACTIF" });
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method, body]).toEqual([`${API}/formateurs/7`, "PATCH", { statut: "INACTIF" }]);
  });
});

describe("niveauxService", () => {
  const NIVEAU_DTO = { id_niveau: 9, code: "HSK 3", libelle: "Mandarin – intermédiaire" };
  const NIVEAU = { idNiveau: 9, code: "HSK 3", libelle: "Mandarin – intermédiaire" };

  it("lister : GET /niveaux (liste complète, sans pagination)", async () => {
    const fetchMock = mockFetch({ body: [NIVEAU_DTO] });
    await expect(httpNiveauxService.lister()).resolves.toEqual([NIVEAU]);
    expect(fetchCall(fetchMock).url).toBe(`${API}/niveaux`);
  });

  it("creer : POST /niveaux", async () => {
    const fetchMock = mockFetch({ status: 201, body: NIVEAU_DTO });
    await expect(httpNiveauxService.creer({ code: "HSK 3", libelle: "Mandarin – intermédiaire" })).resolves.toEqual(NIVEAU);
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method, body]).toEqual([`${API}/niveaux`, "POST", { code: "HSK 3", libelle: "Mandarin – intermédiaire" }]);
  });

  it("modifier : PATCH /niveaux/{id}", async () => {
    const fetchMock = mockFetch({ body: NIVEAU_DTO });
    await httpNiveauxService.modifier(9, { code: "HSK 3", libelle: "Mandarin – intermédiaire" });
    const { url, init } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/niveaux/9`, "PATCH"]);
  });

  it("supprimer : DELETE /niveaux/{id}", async () => {
    const fetchMock = mockFetch({ status: 204 });
    await httpNiveauxService.supprimer(9);
    const { url, init } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/niveaux/9`, "DELETE"]);
  });
});

describe("tableauDeBordService", () => {
  it("consulterStatistiques : GET /admin/statistiques, avec les classes Apprenant, Langue, Abonnement et Formule", async () => {
    const APPRENANT_DTO = { ...UTILISATEUR_DTO, date_naissance: "2000-05-01", pays: null, ville: "Antananarivo", objectif: null };
    const LANGUE_DTO = { id_langue: 2, code: "en", libelle: "Anglais" };
    const fetchMock = mockFetch({
      body: {
        totaux: { utilisateurs: 248, apprenants: 186, formateurs: 42, ateliers_programmes: 18 },
        apprenants_par_langue: [{ langue: LANGUE_DTO, apprenants: 48 }],
        dernieres_inscriptions: [
          {
            apprenant: APPRENANT_DTO,
            langues: [LANGUE_DTO],
            abonnement: {
              id_abonnement: 12,
              date_debut: "2026-10-01",
              date_fin: "2027-01-01",
              statut: "ACTIF",
              quota_heures: 12,
              quota_ateliers: 3,
              formule: {
                id_formule: 2,
                libelle: "Luxe",
                prix_mensuel: 100000,
                duree_mois: 3,
                quota_heures: 12,
                quota_ateliers: 3,
                langues: [{ code: "en", libelle: "Anglais" }],
              },
            },
          },
          { apprenant: { ...APPRENANT_DTO, id_user: 8 }, langues: [], abonnement: null },
        ],
      },
    });

    const stats = await httpTableauDeBordService.consulterStatistiques();

    const { url, init, headers } = fetchCall(fetchMock);
    expect([url, init.method]).toEqual([`${API}/admin/statistiques`, "GET"]);
    expect(headers.Authorization).toBe("Bearer jwt-123");

    const APPRENANT = { ...UTILISATEUR, dateNaissance: "2000-05-01", pays: null, ville: "Antananarivo", objectif: null };
    const LANGUE = { idLangue: 2, code: "en", libelle: "Anglais" };
    expect(stats).toEqual({
      totaux: { utilisateurs: 248, apprenants: 186, formateurs: 42, ateliersProgrammes: 18 },
      apprenantsParLangue: [{ langue: LANGUE, apprenants: 48 }],
      dernieresInscriptions: [
        {
          apprenant: APPRENANT,
          langues: [LANGUE],
          abonnement: {
            idAbonnement: 12,
            dateDebut: "2026-10-01",
            dateFin: "2027-01-01",
            statut: "ACTIF",
            quotaHeures: 12,
            quotaAteliers: 3,
            formule: { idFormule: 2, libelle: "Luxe", prixMensuel: 100000, dureeMois: 3, quotaHeures: 12, quotaAteliers: 3, langues: ["en"] },
          },
        },
        { apprenant: { ...APPRENANT, idUser: 8 }, langues: [], abonnement: null },
      ],
    });
  });

  it("inscriptions : GET /admin/statistiques/inscriptions?jours=", async () => {
    const fetchMock = mockFetch({ body: [{ date: "2026-10-14", nombre: 4 }] });

    const points = await httpTableauDeBordService.inscriptions(7);

    expect(fetchCall(fetchMock).url).toBe(`${API}/admin/statistiques/inscriptions?jours=7`);
    expect(points).toEqual([{ date: "2026-10-14", nombre: 4 }]);
  });
});
