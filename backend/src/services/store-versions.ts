// Versão que está NO AR em cada loja (o que o jogador consegue baixar agora), para o aviso de
// atualização do jogo e o card do painel. Usa as páginas públicas das lojas — a API do Play
// Console mostra a versão enviada mesmo durante a revisão, e o aviso não pode chegar antes da
// atualização existir na loja. Guardado por 10 min (uma consulta para todos os jogadores).

export const APPLE_APP_ID = "6822892071";
export const ANDROID_PACKAGE = "br.com.imperiodebolso.game";
export const STORE_URLS = {
  ios: `https://apps.apple.com/br/app/id${APPLE_APP_ID}`,
  android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
};

const CACHE_MS = 10 * 60 * 1000;
const VERSION = /^\d+(\.\d+){1,3}$/;

export interface LiveVersions {
  ios: { version: string | null; releasedAt: string | null };
  android: { version: string | null };
  checkedAt: string;
}

export function storeVersions(fetchFn: typeof fetch = fetch) {
  let cache: { at: number; value: LiveVersions } | null = null;

  async function apple(): Promise<LiveVersions["ios"]> {
    try {
      const r = (await (
        await fetchFn(`https://itunes.apple.com/lookup?id=${APPLE_APP_ID}&country=br`)
      ).json()) as { results?: { version?: string; currentVersionReleaseDate?: string }[] };
      const a = r.results?.[0];
      const version = a?.version && VERSION.test(a.version) ? a.version : null;
      return { version, releasedAt: a?.currentVersionReleaseDate ?? null };
    } catch {
      return { version: null, releasedAt: null };
    }
  }

  async function google(): Promise<LiveVersions["android"]> {
    try {
      const html = await (
        await fetchFn(`${STORE_URLS.android}&hl=pt_BR&gl=BR`, {
          headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile" },
        })
      ).text();
      // A página traz a versão atual nos dados embutidos como [[["1.0.5"]]].
      const m = html.match(/\[\[\["(\d+\.\d+\.\d+(?:\.\d+)?)"\]\]/);
      return { version: m?.[1] ?? null };
    } catch {
      return { version: null };
    }
  }

  return async function live(fresh = false): Promise<LiveVersions> {
    if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
    const [ios, android] = await Promise.all([apple(), google()]);
    const value = { ios, android, checkedAt: new Date().toISOString() };
    cache = { at: Date.now(), value };
    return value;
  };
}

export type StoreVersions = ReturnType<typeof storeVersions>;
