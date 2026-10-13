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
  return config;
}
