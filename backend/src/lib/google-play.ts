import { createSign } from "node:crypto";

// Google Play Developer API (androidpublisher v3) com a conta de serviço da Play Console.
// Só leitura de compras: o servidor confere o purchaseToken que o jogo mandou; quem consome
// (consumíveis) e reconhece (assinatura) é o jogo, depois que o servidor aceitou — como o
// `finish()` da Apple. Sem conta de serviço configurada, a verificação do Google fica desligada.

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** Compra avulsa (purchases.products.get). purchaseState: 0 paga, 1 cancelada, 2 pendente. */
export interface GoogleProductPurchase {
  purchaseState?: number;
  consumptionState?: number;
  orderId?: string;
  productId?: string;
  /** 0 = compra de teste (testadores licenciados). */
  purchaseType?: number;
}

/** Assinatura (purchases.subscriptionsv2.get). */
export interface GoogleSubscriptionPurchase {
  subscriptionState?: string;
  latestOrderId?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  testPurchase?: object;
}

/** Lançamento de uma faixa (produção, teste interno…) como o Play Console mostra. */
export interface GoogleTrackRelease {
  track: string;
  name?: string;
  status?: string;
  versionCodes?: string[];
  userFraction?: number;
}

export interface GooglePlayApi {
  /** null = token desconhecido para este app/produto (404/410). */
  product(productId: string, token: string): Promise<GoogleProductPurchase | null>;
  subscription(token: string): Promise<GoogleSubscriptionPurchase | null>;
  /** Lançamentos de todas as faixas (abre e descarta uma edição só de leitura). */
  tracks?(): Promise<GoogleTrackRelease[]>;
}

export class GooglePlayError extends Error {}

/** Lê a conta de serviço do env: JSON puro ou em base64 (Dokploy guarda numa linha). */
export function parseServiceAccount(raw: string): GoogleServiceAccount | null {
  const text = raw.trim();
  if (text === "") return null;
  const json = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");
  const sa = JSON.parse(json) as Partial<GoogleServiceAccount>;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT sem client_email/private_key");
  }
  return { client_email: sa.client_email, private_key: sa.private_key, token_uri: sa.token_uri };
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function googlePlayApi(
  packageName: string,
  sa: GoogleServiceAccount,
  fetchFn: typeof fetch = fetch,
): GooglePlayApi {
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  let cached: { token: string; until: number } | null = null;

  async function accessToken(): Promise<string> {
    const nowS = Math.floor(Date.now() / 1000);
    if (cached && cached.until > nowS + 60) return cached.token;
    const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: sa.client_email,
        scope: SCOPE,
        aud: tokenUri,
        iat: nowS,
        exp: nowS + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${head}.${claims}`);
    const jwt = `${head}.${claims}.${b64url(signer.sign(sa.private_key))}`;
    const res = await fetchFn(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) throw new GooglePlayError(`token do Google recusado (${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: body.access_token, until: nowS + body.expires_in };
    return body.access_token;
  }

  async function get<T>(path: string): Promise<T | null> {
    const res = await fetchFn(`${API}/${encodeURIComponent(packageName)}${path}`, {
      headers: { authorization: `Bearer ${await accessToken()}` },
    });
    if (res.status === 404 || res.status === 410 || res.status === 400) return null;
    if (!res.ok) throw new GooglePlayError(`Google Play respondeu ${res.status}`);
    return (await res.json()) as T;
  }

  async function call<T>(method: string, path: string): Promise<T> {
    const res = await fetchFn(`${API}/${encodeURIComponent(packageName)}${path}`, {
      method,
      headers: { authorization: `Bearer ${await accessToken()}` },
    });
    if (!res.ok) throw new GooglePlayError(`Google Play respondeu ${res.status}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  async function tracks(): Promise<GoogleTrackRelease[]> {
    const edit = await call<{ id: string }>("POST", "/edits");
    try {
      const r = await call<{
        tracks?: { track: string; releases?: Omit<GoogleTrackRelease, "track">[] }[];
      }>("GET", `/edits/${edit.id}/tracks`);
      return (r.tracks ?? []).flatMap((t) =>
        (t.releases ?? []).map((rel) => ({ track: t.track, ...rel })),
      );
    } finally {
      await call("DELETE", `/edits/${edit.id}`).catch(() => undefined);
    }
  }

  return {
    tracks,
    product: (productId, token) =>
      get(
        `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`,
      ),
    subscription: (token) => get(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`),
  };
}
