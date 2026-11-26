import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

// Verificação de ID token (JWT) do "Entrar com Google" e "Entrar com a Apple" (ADR 0015).
// Assinatura RS256/ES256 com as chaves públicas do provedor (JWKS), emissor, público
// (client id / bundle id) e validade. Sem dependência externa: só node:crypto.

export type Provider = "google" | "apple";

export const PROVIDERS: Record<Provider, { issuers: string[]; jwksUrl: string }> = {
  google: {
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
  },
  apple: { issuers: ["https://appleid.apple.com"], jwksUrl: "https://appleid.apple.com/auth/keys" },
};

export type JwkResolver = (provider: Provider, kid: string) => Promise<JsonWebKey | undefined>;

export class IdTokenError extends Error {}

export interface IdTokenClaims {
  sub: string;
}

const ALGS: Record<string, { hash: string; dsaEncoding?: "ieee-p1363" }> = {
  RS256: { hash: "sha256" },
  ES256: { hash: "sha256", dsaEncoding: "ieee-p1363" },
};

export async function verifyIdToken(
  provider: Provider,
  token: string,
  audiences: string[],
  resolveKey: JwkResolver,
  now: Date,
): Promise<IdTokenClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new IdTokenError("token malformado");
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let payload: { iss?: string; aud?: string | string[]; exp?: number; sub?: string };
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    throw new IdTokenError("token ilegível");
  }
  const alg = ALGS[header.alg ?? ""];
  if (!alg || !header.kid) throw new IdTokenError("algoritmo ou chave não suportados");
  const jwk = await resolveKey(provider, header.kid);
  if (!jwk) throw new IdTokenError("chave desconhecida");
  const ok = verify(
    alg.hash,
    Buffer.from(`${h}.${p}`, "utf8"),
    {
      key: createPublicKey({ key: jwk, format: "jwk" }),
      ...(alg.dsaEncoding ? { dsaEncoding: alg.dsaEncoding } : {}),
    },
    Buffer.from(s, "base64url"),
  );
  if (!ok) throw new IdTokenError("assinatura inválida");
  if (!PROVIDERS[provider].issuers.includes(payload.iss ?? ""))
    throw new IdTokenError("emissor inválido");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud ?? ""];
  if (!aud.some((a) => audiences.includes(a))) throw new IdTokenError("público inválido");
  if (!payload.exp || payload.exp * 1000 < now.getTime()) throw new IdTokenError("token expirado");
  if (!payload.sub) throw new IdTokenError("sub ausente");
  return { sub: payload.sub };
}

/** Busca e guarda em cache (6 h) as chaves públicas dos provedores. */
export function remoteJwkResolver(fetcher: typeof fetch = fetch): JwkResolver {
  const cache = new Map<Provider, { at: number; keys: Map<string, JsonWebKey> }>();
  return async (provider, kid) => {
    const c = cache.get(provider);
    if (!c || Date.now() - c.at > 6 * 3_600_000 || !c.keys.has(kid)) {
      const res = await fetcher(PROVIDERS[provider].jwksUrl);
      const json = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
      cache.set(provider, { at: Date.now(), keys: new Map(json.keys.map((k) => [k.kid, k])) });
    }
    return cache.get(provider)?.keys.get(kid);
  };
}
