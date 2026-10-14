// Recursos ligados por ambiente (ADR 0018). Definidos uma vez ao montar o app (buildApp);
// lidos por regras que não recebem a configuração (ex.: sorteio das missões).

export const features = {
  /** Compras com dinheiro real (diamantes, Passe VIP). */
  purchases: true,
  /** Anúncios recompensados. */
  ads: true,
};

export function setFeatures(f: { purchases: boolean; ads: boolean }): void {
  features.purchases = f.purchases;
  features.ads = f.ads;
}
