// Catálogo da Loja (ADR 0008). Preços em reais são os da doc (§12) / conversa original;
// valores em diamantes são proposta inicial, ajustáveis aqui.

export type StoreItem =
  | { id: string; kind: "iap"; productId: string; title: string; priceBRL: string; gems: bigint }
  | {
      id: string;
      kind: "subscription";
      productId: string;
      title: string;
      priceBRL: string;
      periodDays: number;
      benefits: string[];
    }
  | { id: string; kind: "auto_collect"; title: string; costGems: bigint; hours: number }
  | { id: string; kind: "boost"; title: string; costGems: bigint; hours: number }
  | {
      id: string;
      kind: "ad";
      title: string;
      placement: "ad_boost";
      minutes: number;
      dailyLimit: number;
    };

const P = "br.com.imperiodebolso";

export const STORE_ITEMS: readonly StoreItem[] = [
  {
    id: "gems_50",
    kind: "iap",
    productId: `${P}.gems_50`,
    title: "Punhado de diamantes",
    priceBRL: "4,90",
    gems: 50n,
  },
  {
    id: "gems_120",
    kind: "iap",
    productId: `${P}.gems_120`,
    title: "Saco de diamantes",
    priceBRL: "9,90",
    gems: 120n,
  },
  {
    id: "gems_300",
    kind: "iap",
    productId: `${P}.gems_300`,
    title: "Baú de diamantes",
    priceBRL: "19,90",
    gems: 300n,
  },
  {
    id: "vip_monthly",
    kind: "subscription",
    productId: `${P}.vip_monthly`,
    title: "Passe VIP",
    priceBRL: "14,90",
    periodDays: 30,
    benefits: ["Auto-coleta em todos os mapas", "Selo VIP no perfil"],
  },
  {
    id: "auto_collect_24h",
    kind: "auto_collect",
    title: "Auto-coleta por 24 horas",
    costGems: 20n,
    hours: 24,
  },
  {
    id: "auto_collect_7d",
    kind: "auto_collect",
    title: "Auto-coleta por 7 dias",
    costGems: 100n,
    hours: 24 * 7,
  },
  { id: "boost_1h", kind: "boost", title: "Turbo: 1 hora de produção", costGems: 10n, hours: 1 },
  { id: "boost_4h", kind: "boost", title: "Turbo: 4 horas de produção", costGems: 30n, hours: 4 },
  {
    id: "ad_boost",
    kind: "ad",
    title: "Assista e ganhe 15 min de produção",
    placement: "ad_boost",
    minutes: 15,
    dailyLimit: 5,
  },
];

/** Anúncio "dobrar ganhos" do resumo offline: limite diário e janela após o resumo. */
export const OFFLINE_DOUBLE_DAILY_LIMIT = 3;
export const OFFLINE_DOUBLE_WINDOW_MS = 15 * 60 * 1000;
export const AD_SESSION_TTL_MS = 10 * 60 * 1000;

export function storeItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find((i) => i.id === id);
}

export function itemByProductId(productId: string): StoreItem | undefined {
  return STORE_ITEMS.find((i) => "productId" in i && i.productId === productId);
}
