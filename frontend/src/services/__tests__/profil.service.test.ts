import { configureApiClient } from "@/lib/api-client";
import { httpProfilService } from "@/services/profil.service";
import { fetchCall, mockFetch } from "@/test/fetch-mock";

/*
 * Contrat avec le backend pour le profil : chaque appel vise la bonne route, envoie les champs
 * en snake_case (ou le fichier en multipart) et convertit la réponse vers les types du frontend.
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

describe("profilService", () => {
  it("getProfil : GET /users/me avec le JWT", async () => {
    const fetchMock = mockFetch({ body: UTILISATEUR_DTO });
    await expect(httpProfilService.getProfil()).resolves.toEqual(UTILISATEUR);
    const { url, headers } = fetchCall(fetchMock);
    expect(url).toBe(`${API}/users/me`);
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });

  it("updateProfil : PATCH /users/me, mot de passe envoyé seulement s'il est changé", async () => {
    const fetchMock = mockFetch({ body: UTILISATEUR_DTO });
    const champs = { prenom: "Rova", nom: "RAKOTO", email: "rova@exemple.com", telephone: "+261 34 12 345 67" };

    await httpProfilService.updateProfil(champs);
    await httpProfilService.updateProfil({ ...champs, motDePasse: "Nouveau2026", motDePasseActuel: "Actuel2026" });

    expect(fetchCall(fetchMock, 0).init.method).toBe("PATCH");
    expect(fetchCall(fetchMock, 0).body).toEqual(champs);
    expect(fetchCall(fetchMock, 1).body).toEqual({ ...champs, mot_de_passe: "Nouveau2026", mot_de_passe_actuel: "Actuel2026" });
  });

  it("uploadPhoto : POST /users/me/photo en multipart, champ « photo », avec le JWT", async () => {
    const fetchMock = mockFetch({ body: { ...UTILISATEUR_DTO, photo_url: "/media/photos/7.jpg" } });
    const photo = new Blob(["image"], { type: "image/jpeg" });

    await expect(httpProfilService.uploadPhoto(photo)).resolves.toEqual({
      ...UTILISATEUR,
      photoUrl: "http://localhost:8000/media/photos/7.jpg",
    });
    const { url, init, headers, body } = fetchCall(fetchMock);
    expect(url).toBe(`${API}/users/me/photo`);
    expect(init.method).toBe("POST");
    expect(headers.Authorization).toBe("Bearer jwt-123");
    // Le navigateur fixe lui-même le Content-Type multipart (avec sa délimitation)
    expect(headers["Content-Type"]).toBeUndefined();
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("photo")).toBeInstanceOf(Blob);
  });

  it("supprimerPhoto : DELETE /users/me/photo", async () => {
    const fetchMock = mockFetch({ body: { ...UTILISATEUR_DTO, photo_url: null } });
    await expect(httpProfilService.supprimerPhoto()).resolves.toEqual(UTILISATEUR);
    expect(fetchCall(fetchMock).url).toBe(`${API}/users/me/photo`);
    expect(fetchCall(fetchMock).init.method).toBe("DELETE");
  });
});
