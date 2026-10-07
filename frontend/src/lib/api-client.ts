const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Message d'erreur renvoyé par le backend (champ `detail`), s'il y en a un. */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
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

export async function apiRequest<T>(path: string, { method = "GET", body, token }: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur.");
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new ApiError(res.status, detail ?? (res.statusText || "Erreur inattendue"), detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
    if (error.status < 500 && error.detail) return error.detail;
    if (error.status >= 500) return "Le serveur rencontre un problème. Réessayez plus tard.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}
