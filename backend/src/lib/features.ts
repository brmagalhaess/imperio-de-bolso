// Recursos ligados por ambiente (ADR 0018). Definidos uma vez ao montar o app (buildApp);
// lidos por regras que não recebem a configuração (ex.: sorteio das missões).

export const features = {
  /** Compras com dinheiro real (diamantes, Passe VIP) em todas as plataformas. */
  purchases: true,
  /** Plataformas com compras mesmo com `purchases` desligado (ex.: só "ios"). */
  purchasePlatforms: [] as string[],
  /** Anúncios recompensados. */
  ads: true,
  /** Plataformas com anúncios mesmo com `ads` desligado (ex.: só "ios"). */
  adPlatforms: [] as string[],
};

export function setFeatures(f: {
  purchases: boolean;
  ads: boolean;
  purchasePlatforms?: string[];
  adPlatforms?: string[];
}): void {
  features.purchases = f.purchases;
  features.ads = f.ads;
  features.purchasePlatforms = f.purchasePlatforms ?? [];
  features.adPlatforms = f.adPlatforms ?? [];
}

/** Compras ligadas para esta plataforma ("ios", "android"; vazio = desconhecida). */
export function purchasesFor(platform: string | undefined): boolean {
  return features.purchases || (!!platform && features.purchasePlatforms.includes(platform));
}

/** Anúncios ligados para esta plataforma. As missões de anúncio seguem só o `ads` global. */
export function adsFor(platform: string | undefined): boolean {
  return features.ads || (!!platform && features.adPlatforms.includes(platform));
}

/**
 * Versão mínima do jogo no Android com a loja do Google e os anúncios (plugins da 1.0.5,
 * ADR 0028). Quem ainda está numa versão anterior não vê itens pagos nem anúncios — eles
 * apareceriam sem como comprar/assistir.
 */
export const ANDROID_STORE_MIN_VERSION = "1.0.5";

/** "1.0.10" > "1.0.9": compara versões numéricas por partes. */
export function versionAtLeast(version: string | undefined, min: string): boolean {
  if (!version) return false;
  const a = version.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const b = min.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

/**
 * Plataforma que vale para loja/anúncios: Android só a partir da versão com os plugins (o jogo
 * manda X-App-Version). Versões antigas contam como plataforma desconhecida.
 */
export function storePlatform(platform: string | undefined, version: string | undefined) {
  if (platform === "android" && !versionAtLeast(version, ANDROID_STORE_MIN_VERSION)) return "other";
  return platform;
}

/** Loja → plataforma (para a verificação de recibos). */
export const STORE_PLATFORM: Record<string, string> = { apple: "ios", google: "android" };
