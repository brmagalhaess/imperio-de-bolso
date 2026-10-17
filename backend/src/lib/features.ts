// Recursos ligados por ambiente (ADR 0018). Definidos uma vez ao montar o app (buildApp);
// lidos por regras que não recebem a configuração (ex.: sorteio das missões).

export const features = {
  /** Compras com dinheiro real (diamantes, Passe VIP) em todas as plataformas. */
  purchases: true,
  /** Plataformas com compras mesmo com `purchases` desligado (ex.: só "ios"). */
  purchasePlatforms: [] as string[],
  /** Anúncios recompensados. */
  ads: true,
};

export function setFeatures(f: {
  purchases: boolean;
  ads: boolean;
  purchasePlatforms?: string[];
}): void {
  features.purchases = f.purchases;
  features.ads = f.ads;
  features.purchasePlatforms = f.purchasePlatforms ?? [];
}

/** Compras ligadas para esta plataforma ("ios", "android"; vazio = desconhecida). */
export function purchasesFor(platform: string | undefined): boolean {
  return features.purchases || (!!platform && features.purchasePlatforms.includes(platform));
}

/** Loja → plataforma (para a verificação de recibos). */
export const STORE_PLATFORM: Record<string, string> = { apple: "ios", google: "android" };
