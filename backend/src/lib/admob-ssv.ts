import { createPublicKey, verify } from "node:crypto";

// Verificação de recompensa do AdMob no servidor (SSV — plano §23). O Google chama nosso
// endpoint com a query assinada (ECDSA P-256 / SHA-256). A mensagem assinada é a query até
// antes de "&signature="; `signature` (base64 URL-safe, DER) e `key_id` vêm por último.
// Chaves públicas: https://www.gstatic.com/admob/reward/verifier-keys.json

export interface SsvParams {
  transactionId: string;
  customData: string;
  rewardAmount: string;
  adUnit: string;
  userId: string;
}

export type KeyResolver = (keyId: string) => Promise<string | undefined>;

export class SsvError extends Error {}

export async function verifySsv(rawQuery: string, resolveKey: KeyResolver): Promise<SsvParams> {
  const idx = rawQuery.indexOf("&signature=");
  if (idx < 0) throw new SsvError("assinatura ausente");
  const message = rawQuery.slice(0, idx);
  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  if (!signature || !keyId) throw new SsvError("assinatura ou key_id ausente");
  const pem = await resolveKey(keyId);
  if (!pem) throw new SsvError(`chave ${keyId} desconhecida`);
  const ok = verify(
    "sha256",
    Buffer.from(message, "utf8"),
    { key: createPublicKey(pem), dsaEncoding: "der" },
    Buffer.from(signature, "base64url"),
  );
  if (!ok) throw new SsvError("assinatura inválida");
  // Assinatura válida sem sessão (ex.: o teste "Verificar URL" do AdMob): não é erro — o
  // ssvVerified só não confirma nada. Responder 200 evita que o Google fique reenviando.
  return {
    transactionId: params.get("transaction_id") ?? "",
    customData: params.get("custom_data") ?? "",
    rewardAmount: params.get("reward_amount") ?? "",
    adUnit: params.get("ad_unit") ?? "",
    userId: params.get("user_id") ?? "",
  };
}

/** Busca e guarda em cache (24 h) as chaves públicas do AdMob. */
export function admobKeyResolver(url: string, fetcher: typeof fetch = fetch): KeyResolver {
  let cache: { at: number; keys: Map<string, string> } | null = null;
  return async (keyId) => {
    if (!cache || Date.now() - cache.at > 24 * 3_600_000 || !cache.keys.has(keyId)) {
      const res = await fetcher(url);
      const json = (await res.json()) as { keys: { keyId: number | string; pem: string }[] };
      cache = { at: Date.now(), keys: new Map(json.keys.map((k) => [String(k.keyId), k.pem])) };
    }
    return cache.keys.get(keyId);
  };
}
