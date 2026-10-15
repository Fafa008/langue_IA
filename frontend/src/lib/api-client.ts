import { API_URL } from "@/lib/env";

/*
 * Client HTTP unique de l'application : tous les services passent par apiRequest().
 * Il ajoute l'URL du backend, le JWT, le format JSON, et traduit les erreurs en ApiError.
 */

/** Codes HTTP qui ont un sens métier pour l'application. */
export const HTTP_STATUS = {
  /** Donnée refusée par une règle métier (ex. mot de passe actuel incorrect dans le profil) */
  BAD_REQUEST: 400,
  /** Identifiants incorrects, ou JWT absent / expiré */
  UNAUTHORIZED: 401,
  /** Compte inactif ou suspendu, ou droits insuffisants */
  FORBIDDEN: 403,
  /** Ressource déjà existante (ex. e-mail déjà utilisé) */
  CONFLICT: 409,
} as const;

/** Au-delà, la requête est abandonnée et l'utilisateur voit un message d'erreur. */
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    /** Code HTTP, ou 0 si le serveur n'a pas répondu. */
    public readonly status: number,
    message: string,
    /** Message d'erreur renvoyé par le backend (champ `detail`), s'il y en a un. */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* Session : le client lit le JWT et signale son refus sans connaître le store (configuré dans app/providers.tsx). */

interface AuthHandlers {
  getToken: () => string | null;
  /** Appelé quand le serveur refuse le JWT (401) sur une route authentifiée. */
  onUnauthorized: () => void;
}

let authHandlers: AuthHandlers = { getToken: () => null, onUnauthorized: () => {} };

export function configureApiClient(handlers: AuthHandlers) {
  authHandlers = handlers;
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Objet envoyé en JSON, ou FormData pour un envoi de fichier. */
  body?: unknown;
  /** Paramètres d'URL ; les valeurs vides (null, undefined, "") sont omises. */
  query?: Record<string, QueryValue>;
  /**
   * false pour les routes publiques (connexion, inscription…) : pas de JWT envoyé,
   * et un 401 y signifie « identifiants incorrects », pas « session expirée ».
   */
  auth?: boolean;
}

/** « /api/v1/users » + { page: 2, search: "" } → « http://…/api/v1/users?page=2 » */
export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ""}`;
}

/** Extrait le message d'erreur d'une réponse FastAPI ({ detail: string | [...] }). */
async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {
    // corps vide ou non JSON
  }
}

export async function apiRequest<T>(path: string, { method = "GET", body, query, auth = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  // Un FormData (envoi de fichier) fixe lui-même son Content-Type multipart
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  const token = auth ? authHandlers.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, controller.signal.aborted ? "Le serveur ne répond pas." : "Impossible de joindre le serveur.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.status === HTTP_STATUS.UNAUTHORIZED && auth) authHandlers.onUnauthorized();
    const detail = await readErrorDetail(res);
    throw new ApiError(res.status, detail ?? (res.statusText || "Erreur inattendue"), detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Une erreur 4xx ne changera pas en réessayant (données refusées, droits…) : seules les pannes sont retentées. */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500);
}

/**
 * Traduit une erreur en message affichable.
 * `byStatus` permet à l'appelant de personnaliser le message selon le code HTTP ;
 * sinon, pour une erreur 4xx, on affiche l'explication du backend (ex. donnée refusée).
 */
export function getErrorMessage(error: unknown, byStatus: Record<number, string> = {}): string {
  if (error instanceof ApiError) {
    if (byStatus[error.status]) return byStatus[error.status];
    if (error.status === 0) return error.message;
    if (error.status === HTTP_STATUS.FORBIDDEN) return "Vous n'avez pas les droits nécessaires pour cette action.";
    if (error.status < 500 && error.detail) return error.detail;
    if (error.status >= 500) return "Le serveur rencontre un problème. Réessayez plus tard.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}
