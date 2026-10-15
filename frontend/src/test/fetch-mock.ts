/* Simulation de fetch pour les tests unitaires de la couche HTTP (sans backend). */

export interface FakeResponse {
  status?: number;
  body?: unknown;
}

/** Remplace global.fetch ; chaque appel renvoie la réponse suivante de la liste (la dernière est réutilisée). */
export function mockFetch(...responses: FakeResponse[]) {
  const fetchMock = jest.fn(async () => {
    const { status = 200, body } = responses.length > 1 ? responses.shift()! : responses[0] ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      json: async () => {
        if (body === undefined) throw new SyntaxError("Corps vide");
        return body;
      },
    } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** URL, options et corps JSON décodé du n-ième appel à fetch. */
export function fetchCall(fetchMock: jest.Mock, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
  return { url, init, headers: init.headers as Record<string, string>, body };
}
