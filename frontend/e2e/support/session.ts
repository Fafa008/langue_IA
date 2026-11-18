import type { Page, Route } from "@playwright/test";

/* Outils partagés des tests E2E : réponses simulées de l'API et session ouverte d'avance. */

export const STORAGE_KEY = "digitheque-auth";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

/** JWT non signé valable 1 h (le frontend lit seulement sa date d'expiration). */
export const ACCESS_TOKEN = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ sub: "1", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"),
  "signature",
].join(".");

/** Utilisateur au format de l'API (snake_case). */
export interface UtilisateurDto {
  id_user: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: "APPRENANT" | "FORMATEUR" | "ADMINISTRATEUR";
  statut: "ACTIF" | "INACTIF" | "SUSPENDU";
  date_inscription: string;
  photo_url?: string | null;
}

/** Réponse JSON de l'API simulée (CORS compris, l'API étant sur un autre port). */
export const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify(body) });

/** Répond aux requêtes préliminaires CORS ; renvoie true si la requête a été traitée. */
export async function handlePreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== "OPTIONS") return false;
  await route.fulfill({ status: 204, headers: CORS_HEADERS });
  return true;
}

/** Ouvre une session pour `dto` (comme après une connexion avec « Se souvenir de moi »). */
export async function loginAs(page: Page, dto: UtilisateurDto) {
  await page.addInitScript(
    ([key, token, u]) => {
      // N'écrit la session qu'au premier chargement, pour ne pas écraser ses mises à jour
      if (sessionStorage.getItem("init")) return;
      sessionStorage.setItem("init", "1");
      const utilisateur = {
        idUser: u.id_user,
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        telephone: u.telephone,
        role: u.role,
        statut: u.statut,
        dateInscription: u.date_inscription,
        photoUrl: u.photo_url ? `http://localhost:8000${u.photo_url}` : null,
      };
      localStorage.setItem(key, JSON.stringify({ state: { utilisateur, accessToken: token, remember: true }, version: 0 }));
    },
    [STORAGE_KEY, ACCESS_TOKEN, dto] as const,
  );
}
