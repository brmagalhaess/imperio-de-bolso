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

  /** "1.0.10" > "1.0.9". */
  const newer = (a: string, b: string) => {
    const x = a.split(".").map(Number);
    const y = b.split(".").map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
    }
    return false;
  };

  async function lookup(country: string) {
    try {
      const r = (await (
        await fetchFn(`https://itunes.apple.com/lookup?id=${APPLE_APP_ID}&country=${country}`)
      ).json()) as { results?: { version?: string; currentVersionReleaseDate?: string }[] };
      const a = r.results?.[0];
      return a?.version && VERSION.test(a.version)
        ? { version: a.version, releasedAt: a.currentVersionReleaseDate ?? null }
        : null;
    } catch {
      return null;
    }
  }

  // O cache de cada país da App Store atualiza em horários diferentes: vale a mais nova.
  async function apple(): Promise<LiveVersions["ios"]> {
    const found = (await Promise.all(["br", "us"].map(lookup))).filter((x) => x !== null);
    const best = found.reduce<(typeof found)[number] | null>(
      (acc, x) => (acc === null || newer(x.version, acc.version) ? x : acc),
      null,
    );
    return best ?? { version: null, releasedAt: null };
  }

  async function google(): Promise<LiveVersions["android"]> {
    try {
      const html = await (
        await fetchFn(`${STORE_URLS.android}&hl=pt_BR&gl=BR`, {
          // Identificação de navegador completa: a curta recebe 403 da Play Store.
          headers: {
            "user-agent":
              "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "accept-language": "pt-BR",
          },
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
