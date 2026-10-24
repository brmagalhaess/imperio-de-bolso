// Cliente da API admin (leitura, moderação e suporte, ADR 0021/0030). Token só na aba (sessionStorage).
const TOKEN_KEY = "imperio_admin_token";

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || __DEV_ADMIN_TOKEN__;
  } catch {
    return __DEV_ADMIN_TOKEN__;
  }
}

export function setToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* navegação privada: o token vale só nesta página */
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function adminGet<T>(
  path: string,
  token = getToken(),
): Promise<T> {
  return adminRequest<T>("GET", path, token);
}

export async function adminPost<T>(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  return adminRequest<T>("POST", path, getToken(), body, headers);
}

async function adminRequest<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      res.status,
      data?.error?.message ?? `Erro ${res.status}`,
    );
  return data as T;
}

export interface Overview {
  players: number;
  newToday: number;
  dau: number;
  wau: number;
  tutorialCompletionRate: number;
  d1Retention: number | null;
  coinsInCirculation: string;
  gemsInCirculation: string;
  eventsLast24h: Record<string, number>;
  d7Retention: number | null;
  prestige: { players: number; sales: number; stars: number };
  boosts: { autoCollect: number; turbo: number; vip: number };
  linkedAccounts: Record<string, number>;
  today: {
    missionsClaimed: number;
    chestsOpened: number;
    dailyRewards: number;
    gemsSpent: string;
  };
  weekendEvent: { id: string; participants: number; claimed: number } | null;
  openReports: number;
  mapFunnel: { district: string; players: number }[];
  features: { purchases: boolean; ads: boolean };
  serverTime: string;
}

export interface Economy {
  businesses: {
    slug: string;
    name: string;
    district: string;
    cost: string;
    owners: number;
    helpers: number;
    avgLevel: number | null;
    maxLevel: number | null;
    tiers: number[];
  }[];
  flows7d: { currency: string; reason: string; total: string; count: number }[];
}

export interface Ranking {
  week: { id: string; start: string; end: string };
  top: { rank: number; playerId: string; displayName: string; score: string }[];
  leagues: { tier: number; name: string; players: number }[];
  podium: {
    week: string;
    rewards: {
      playerId: string;
      displayName: string;
      kind: string;
      league: number | null;
      rank: number;
      gems: number;
      claimed: boolean;
    }[];
  };
}

export interface Reports {
  resolved: number;
  open: {
    playerId: string;
    displayName: string;
    customName: boolean;
    reports: number;
    lastReportAt: string | null;
  }[];
}

export interface PlayerRow {
  id: string;
  displayName: string;
  createdAt: string;
  lastSeenAt: string | null;
  currentDistrict: string | null;
  tutorialCompleted: boolean;
  coins: string;
  gems: string;
  businesses: number;
  prestigeStars: number;
  linked: boolean;
  staff: boolean;
  platform: string | null;
  appVersion: string | null;
}

export interface PlayerDetail {
  id: string;
  displayName: string;
  code: string;
  createdAt: string;
  lastSeenAt: string | null;
  currentDistrict: string | null;
  tutorialCompleted: boolean;
  nameChanged: boolean;
  staff: boolean;
  platform: string | null;
  appVersion: string | null;
  coins: string;
  gems: string;
  prestige: { stars: number; count: number };
  league: string | null;
  loginStreak: number;
  boosts: {
    vipUntil: string | null;
    autoCollectUntil: string | null;
    turboUntil: string | null;
  };
  identities: string[];
  achievements: number;
  openReports: number;
  missionsToday: {
    template: string;
    progress: string;
    target: string;
    claimed: boolean;
  }[];
  businesses: {
    slug: string;
    name: string;
    district: string;
    level: number;
    helper: boolean;
  }[];
  ledger: {
    at: string;
    currency: string;
    delta: string;
    balanceAfter: string;
    reason: string;
  }[];
}

export interface EventRow {
  id: string;
  playerId: string | null;
  name: string;
  props: Record<string, unknown>;
  at: string;
}

export interface PlatformRow {
  platform: string;
  players: number;
  newToday: number;
  new7d: number;
  activeToday: number;
  active7d: number;
  versions: { version: string; players: number }[];
}

export interface TrendDay {
  day: string;
  newPlayers: number;
  activePlayers: number;
  purchases: number;
  revenueBRL: number;
  adViews: number;
  prestiges: number;
}

export interface Trends {
  days: TrendDay[];
  serverTime: string;
}

export interface PurchaseRow {
  at: string;
  playerId?: string | null;
  displayName?: string;
  productId: string;
  title: string;
  priceBRL: number;
  store: string;
  transactionId: string;
  status: string;
}

export interface Revenue {
  totals: {
    revenueBRL: number;
    revenue30dBRL: number;
    purchases: number;
    purchases30d: number;
    refunds: number;
    buyers: number;
    activeSubscriptions: Record<string, number>;
  };
  byStore: { store: string; purchases: number; revenueBRL: number }[];
  byProduct: {
    productId: string;
    title: string;
    priceBRL: number;
    count: number;
    revenueBRL: number;
    refunds: number;
  }[];
  recent: PurchaseRow[];
  serverTime: string;
}
