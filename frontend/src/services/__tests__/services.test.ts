import { configureApiClient } from "@/lib/api-client";
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
