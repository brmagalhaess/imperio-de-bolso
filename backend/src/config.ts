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
  ADMIN_TOKEN: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(32, "ADMIN_TOKEN precisa de pelo menos 32 caracteres").optional(),
  ),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === "production" && /troque|dev-only|change-me/i.test(config.JWT_SECRET)) {
    throw new Error("JWT_SECRET de exemplo não pode ser usado em produção");
  }
  if (
    config.NODE_ENV === "production" &&
    !config.BETA_SANDBOX &&
    (config.STORE_MODE === "mock" || config.ADS_MODE === "mock")
  ) {
    throw new Error(
      "STORE_MODE/ADS_MODE mock não podem ser usados em produção (exceto BETA_SANDBOX=true)",
    );
  }
  return config;
}
