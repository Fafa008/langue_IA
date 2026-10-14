import { configureApiClient } from "@/lib/api-client";
import { httpLanguesService } from "@/services/langues.service";
import { httpNiveauxService } from "@/services/niveaux.service";
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
