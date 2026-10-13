// Cliente da API admin (somente leitura). O token fica só na aba (sessionStorage).
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

export async function adminGet<T>(path: string, token = getToken()): Promise<T> {
  const res = await fetch(`/api/admin${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? `Erro ${res.status}`);
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
  serverTime: string;
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
}

export interface PlayerDetail {
  id: string;
  displayName: string;
  coins: string;
  gems: string;
  businesses: { slug: string; level: number; helper: boolean }[];
  ledger: { at: string; currency: string; delta: string; balanceAfter: string; reason: string }[];
}

export interface EventRow {
  id: string;
  playerId: string | null;
  name: string;
  props: Record<string, unknown>;
  at: string;
}
