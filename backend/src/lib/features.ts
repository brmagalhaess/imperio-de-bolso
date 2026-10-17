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

/** Loja → plataforma (para a verificação de recibos). */
export const STORE_PLATFORM: Record<string, string> = { apple: "ios", google: "android" };
