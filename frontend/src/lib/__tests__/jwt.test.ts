import { getJwtExpiry, isJwtExpired } from "@/lib/jwt";

/** Construit un JWT non signé avec le contenu donné (format base64url, comme le backend). */
const jwt = (payload: object) =>
  `xxx.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

describe("getJwtExpiry", () => {
  it("lit le champ exp (en secondes) et le renvoie en millisecondes", () => {
    expect(getJwtExpiry(jwt({ sub: "1", exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it("renvoie null si le token n'a pas de date d'expiration ou est illisible", () => {
    expect(getJwtExpiry(jwt({ sub: "1" }))).toBeNull();
    expect(getJwtExpiry("pas-un-jwt")).toBeNull();
  });
});

describe("isJwtExpired", () => {
  const now = 1_800_000_000_000;

  it("détecte un token expiré", () => {
    expect(isJwtExpired(jwt({ exp: now / 1000 - 1 }), now)).toBe(true);
  });

  it("accepte un token encore valable", () => {
    expect(isJwtExpired(jwt({ exp: now / 1000 + 3600 }), now)).toBe(false);
  });
});
