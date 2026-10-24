import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  STARTING_COINS: z.coerce.bigint().nonnegative().default(100n),
  // Painel admin (somente leitura). Sem token configurado, as rotas /api/admin ficam desligadas.
  // Loja e anúncios (ADR 0008). "mock" = simulação para desenvolvimento (nada é cobrado);
  // produção exige os provedores reais (google/apple e admob) — mock é recusado lá.
  STORE_MODE: z.enum(["mock", "live"]).default("mock"),
  ADS_MODE: z.enum(["mock", "admob"]).default("mock"),
  // Teste fechado (staging): permite mock em NODE_ENV=production. NUNCA na loja pública.
  BETA_SANDBOX: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Versão 1.0 nas lojas sai sem dinheiro real e sem anúncios (ADR 0018): itens em R$ e
  // anúncios somem do catálogo e as rotas recusam. Padrão: ligados fora da produção.
  PURCHASES_ENABLED: z.enum(["true", "false"]).optional(),
  // Liga as compras só em algumas plataformas ("ios", "android"), separadas por vírgula —
  // ex.: PURCHASES_PLATFORMS=ios abre a loja paga no iPhone com a Android ainda sem compras.
  PURCHASES_PLATFORMS: z.string().default(""),
  // Bundle id esperado nos recibos da App Store (StoreKit 2).
  APPLE_BUNDLE_ID: z.string().default("br.com.imperiodebolso.game"),
  // Google Play Billing: pacote do app e conta de serviço da Play Console (JSON ou base64 do
  // JSON) com permissão de ver pedidos. Vazio = compras do Google não são verificadas (501).
  GOOGLE_PLAY_PACKAGE: z.string().default("br.com.imperiodebolso.game"),
  GOOGLE_PLAY_SERVICE_ACCOUNT: z.string().default(""),
  ADS_ENABLED: z.enum(["true", "false"]).optional(),
  // Anúncios só em algumas plataformas (ex.: ADS_PLATFORMS=ios), como PURCHASES_PLATFORMS.
  ADS_PLATFORMS: z.string().default(""),
  ADMOB_KEYS_URL: z.url().default("https://www.gstatic.com/admob/reward/verifier-keys.json"),
  // Atrás do proxy do Dockploy (Traefik), confie no X-Forwarded-For para o IP real.
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Limites de requisições por IP (plano §24/§28). Redes móveis compartilham IP: limites folgados.
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(20),
  // Vazio (ex.: `ADMIN_TOKEN=` no compose) = desligado.
  // Contas vinculadas (ADR 0015): client ids OAuth do Google e bundle ids/Services IDs da
  // Apple aceitos como público do ID token, separados por vírgula. Vazio = vínculo desligado.
  GOOGLE_CLIENT_IDS: z.string().default(""),
  APPLE_AUDIENCES: z.string().default(""),
  ADMIN_TOKEN: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(32, "ADMIN_TOKEN precisa de pelo menos 32 caracteres").optional(),
  ),
});

type ParsedConfig = z.infer<typeof ConfigSchema>;
export type AppConfig = Omit<ParsedConfig, "PURCHASES_ENABLED" | "ADS_ENABLED"> & {
  PURCHASES_ENABLED: boolean;
  ADS_ENABLED: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  const dev = parsed.data.NODE_ENV !== "production";
  const config: AppConfig = {
    ...parsed.data,
    PURCHASES_ENABLED: (parsed.data.PURCHASES_ENABLED ?? (dev ? "true" : "false")) === "true",
    ADS_ENABLED: (parsed.data.ADS_ENABLED ?? (dev ? "true" : "false")) === "true",
  };
  if (config.NODE_ENV === "production" && /troque|dev-only|change-me/i.test(config.JWT_SECRET)) {
    throw new Error("JWT_SECRET de exemplo não pode ser usado em produção");
  }
  if (
    config.NODE_ENV === "production" &&
    !config.BETA_SANDBOX &&
    ((config.PURCHASES_ENABLED && config.STORE_MODE === "mock") ||
      ((config.ADS_ENABLED || config.ADS_PLATFORMS.trim() !== "") && config.ADS_MODE === "mock"))
  ) {
    throw new Error(
      "STORE_MODE/ADS_MODE mock não podem ser usados em produção (exceto BETA_SANDBOX=true)",
    );
  }
  return config;
}
