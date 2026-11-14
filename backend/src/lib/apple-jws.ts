import { X509Certificate, verify as verifySignature } from "node:crypto";

// Verificação dos JWS assinados pela App Store (StoreKit 2 e App Store Server Notifications V2).
// O cabeçalho traz a cadeia x5c [folha, intermediária, raiz]; a raiz precisa ser a "Apple Root
// CA - G3" (fixada pela impressão digital), cada certificado assina o seguinte, todos válidos na
// data e com os OIDs de uso da Apple; a assinatura ES256 é conferida com a chave da folha.

/** SHA-256 da Apple Root CA - G3 (https://www.apple.com/certificateauthority/AppleRootCA-G3.cer). */
export const APPLE_ROOT_G3_SHA256 =
  "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79";

/** OID 1.2.840.113635.100.6.11.1 (folha que assina recibos) em DER. */
const LEAF_OID = Buffer.from("060a2a864886f76364060b01", "hex");
/** OID 1.2.840.113635.100.6.2.1 (intermediária WWDR) em DER. */
const INTERMEDIATE_OID = Buffer.from("060a2a864886f763640602 01".replace(/ /g, ""), "hex");

export class AppleJwsError extends Error {}

export interface AppleJwsOptions {
  now: Date;
  /** Impressão digital aceita para a raiz (testes usam uma própria). */
  rootFingerprint?: string;
}

const b64url = (s: string) => Buffer.from(s, "base64url");

/** Confere o JWS e devolve o payload decodificado. Lança AppleJwsError se algo não bater. */
export function verifyAppleJws(jws: string, opts: AppleJwsOptions): Record<string, unknown> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new AppleJwsError("JWS malformado");
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; x5c?: string[] };
  try {
    header = JSON.parse(b64url(h).toString("utf8"));
  } catch {
    throw new AppleJwsError("cabeçalho inválido");
  }
  if (header.alg !== "ES256") throw new AppleJwsError("algoritmo inesperado");
  const chain = (header.x5c ?? []).map((c) => new X509Certificate(Buffer.from(c, "base64")));
  if (chain.length !== 3) throw new AppleJwsError("cadeia de certificados incompleta");
  const [leaf, intermediate, root] = chain as [X509Certificate, X509Certificate, X509Certificate];

  if (root.fingerprint256 !== (opts.rootFingerprint ?? APPLE_ROOT_G3_SHA256)) {
    throw new AppleJwsError("raiz não é a Apple Root CA - G3");
  }
  const t = opts.now.getTime();
  for (const c of chain) {
    if (t < Date.parse(c.validFrom) || t > Date.parse(c.validTo)) {
      throw new AppleJwsError("certificado fora da validade");
    }
  }
  if (!leaf.verify(intermediate.publicKey) || !intermediate.verify(root.publicKey)) {
    throw new AppleJwsError("cadeia de certificados inválida");
  }
  if (!leaf.raw.includes(LEAF_OID) || !intermediate.raw.includes(INTERMEDIATE_OID)) {
    throw new AppleJwsError("certificado sem o uso da Apple");
  }
  const ok = verifySignature(
    "sha256",
    Buffer.from(`${h}.${p}`),
    { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
    b64url(s),
  );
  if (!ok) throw new AppleJwsError("assinatura inválida");
  try {
    return JSON.parse(b64url(p).toString("utf8"));
  } catch {
    throw new AppleJwsError("payload inválido");
  }
}
