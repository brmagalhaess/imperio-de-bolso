// Cliente da API admin (leitura + moderação de nomes, ADR 0021). Token só na aba (sessionStorage).
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

export async function adminPost<T>(path: string): Promise<T> {
  return adminRequest<T>("POST", path, getToken());
}

async function adminRequest<T>(
  method: string,
  path: string,
  token: string,
): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Erro ${res.status}`,
    );
  return body as T;
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
