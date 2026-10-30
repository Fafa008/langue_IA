import { ApiError, apiRequest, buildUrl, configureApiClient, getErrorMessage, isRetryable } from "@/lib/api-client";
import { fetchCall, mockFetch } from "@/test/fetch-mock";

const onUnauthorized = jest.fn();

beforeEach(() => {
  onUnauthorized.mockReset();
  configureApiClient({ getToken: () => "jwt-123", onUnauthorized });
});

describe("buildUrl", () => {
  it("préfixe l'URL du backend et omet les paramètres vides", () => {
    expect(buildUrl("/api/v1/users", { page: 2, search: "", role: null, actif: false, x: undefined })).toBe(
      "http://localhost:8000/api/v1/users?page=2&actif=false",
    );
    expect(buildUrl("/api/v1/formules")).toBe("http://localhost:8000/api/v1/formules");
  });

  it("encode les caractères spéciaux", () => {
    expect(buildUrl("/x", { search: "élodie & co" })).toBe("http://localhost:8000/x?search=%C3%A9lodie+%26+co");
  });
});

describe("apiRequest", () => {
  it("envoie le JWT et un corps JSON", async () => {
    const fetchMock = mockFetch({ body: { ok: true } });

    await expect(apiRequest("/api/v1/users/me", { method: "PATCH", body: { nom: "RAKOTO" } })).resolves.toEqual({ ok: true });

    const { url, init, headers, body } = fetchCall(fetchMock);
    expect(url).toBe("http://localhost:8000/api/v1/users/me");
    expect(init.method).toBe("PATCH");
    expect(headers).toEqual({ Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer jwt-123" });
    expect(body).toEqual({ nom: "RAKOTO" });
  });

  it("n'envoie pas de JWT sur une route publique", async () => {
    const fetchMock = mockFetch({ body: {} });
    await apiRequest("/api/v1/auth/login", { method: "POST", auth: false, body: {} });
    expect(fetchCall(fetchMock).headers.Authorization).toBeUndefined();
  });

  it("n'envoie pas d'en-tête Authorization sans session", async () => {
    configureApiClient({ getToken: () => null, onUnauthorized });
    const fetchMock = mockFetch({ body: [] });
    await apiRequest("/api/v1/formules");
    expect(fetchCall(fetchMock).headers).toEqual({ Accept: "application/json" });
  });

  it("renvoie undefined pour une réponse 204", async () => {
    mockFetch({ status: 204 });
    await expect(apiRequest("/api/v1/auth/forgot-password", { method: "POST" })).resolves.toBeUndefined();
  });

  it("traduit une erreur FastAPI en ApiError avec son détail", async () => {
    mockFetch({ status: 409, body: { detail: "Email already registered" } });
    await expect(apiRequest("/x")).rejects.toEqual(new ApiError(409, "Email already registered", "Email already registered"));
  });

  it("lit le premier message d'une erreur de validation (422)", async () => {
    mockFetch({ status: 422, body: { detail: [{ msg: "value is not a valid email address", loc: ["body", "email"] }] } });
    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 422, detail: "value is not a valid email address" });
  });

  it("signale un JWT refusé (401) sur une route authentifiée", async () => {
    mockFetch({ status: 401, body: { detail: "Not authenticated" } });
    await expect(apiRequest("/api/v1/users/me")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("ne traite pas un 401 de connexion comme une session expirée", async () => {
    mockFetch({ status: 401, body: { detail: "Incorrect email or password" } });
    await expect(apiRequest("/api/v1/auth/login", { auth: false })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("renvoie une ApiError de statut 0 si le serveur est injoignable", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiRequest("/x")).rejects.toEqual(new ApiError(0, "Impossible de joindre le serveur."));
  });

  it("abandonne la requête après 15 s sans réponse", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted")))),
    ) as unknown as typeof fetch;

    const request = apiRequest("/x");
    jest.advanceTimersByTime(15_000);

    await expect(request).rejects.toEqual(new ApiError(0, "Le serveur ne répond pas.", undefined, true));
    jest.useRealTimers();
  });

  it("accepte un délai plus long pour une requête lente (analyse par le LLM)", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted")))),
    ) as unknown as typeof fetch;
    let terminee = false;

    const request = apiRequest("/x", { timeoutMs: 60_000 });
    request.catch(() => { terminee = true; });
    jest.advanceTimersByTime(15_000);
    await Promise.resolve();
    expect(terminee).toBe(false);
    jest.advanceTimersByTime(45_000);

    await expect(request).rejects.toMatchObject({ status: 0, delaiDepasse: true });
    jest.useRealTimers();
  });
});

describe("isRetryable", () => {
  it("ne réessaie que les pannes, pas les erreurs 4xx", () => {
    expect(isRetryable(new ApiError(0, "réseau"))).toBe(true);
    expect(isRetryable(new ApiError(503, "panne"))).toBe(true);
    expect(isRetryable(new ApiError(404, "absent"))).toBe(false);
    expect(isRetryable(new ApiError(401, "session"))).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("privilégie le message propre à l'écran", () => {
    expect(getErrorMessage(new ApiError(409, "x", "Email already registered"), { 409: "E-mail déjà utilisé." })).toBe("E-mail déjà utilisé.");
  });

  it("affiche un message générique pour une panne ou une erreur inconnue", () => {
    expect(getErrorMessage(new ApiError(500, "x"))).toBe("Le serveur rencontre un problème. Réessayez plus tard.");
    expect(getErrorMessage(new ApiError(403, "x"))).toBe("Vous n'avez pas les droits nécessaires pour cette action.");
    expect(getErrorMessage(new Error("boum"))).toBe("Une erreur est survenue. Veuillez réessayer.");
  });
});
