// Erros de domínio com código estável; o cliente traduz pelo código, não pela mensagem.
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: () => new AppError(401, "UNAUTHORIZED", "Sessão inválida ou expirada"),
  invalidGuestCredentials: () =>
    new AppError(401, "INVALID_GUEST_CREDENTIALS", "Credenciais de convidado inválidas"),
  businessNotFound: (slug: string) =>
    new AppError(404, "BUSINESS_NOT_FOUND", "Negócio não encontrado", { slug }),
  businessNotOwned: (slug: string) =>
    new AppError(409, "BUSINESS_NOT_OWNED", "Você ainda não possui este negócio", { slug }),
  businessAlreadyOwned: (slug: string) =>
    new AppError(409, "BUSINESS_ALREADY_OWNED", "Você já possui este negócio", { slug }),
  maxLevel: (slug: string) =>
    new AppError(409, "MAX_LEVEL_REACHED", "Nível máximo atingido", { slug }),
  insufficientFunds: (required: bigint, available: bigint) =>
    new AppError(409, "INSUFFICIENT_FUNDS", "Saldo insuficiente", {
      required: required.toString(),
      available: available.toString(),
    }),
  notReady: (slug: string, secondsRemaining: number) =>
    new AppError(409, "PRODUCTION_NOT_READY", "A produção ainda não terminou", {
      slug,
      secondsRemaining,
    }),
  districtLocked: (district: string, requires: string) =>
    new AppError(
      409,
      "DISTRICT_LOCKED",
      "Distrito bloqueado: complete o distrito anterior primeiro",
      { district, requires },
    ),
  managerActive: (slug: string) =>
    new AppError(409, "MANAGER_ACTIVE", "Este negócio está produzindo sozinho", { slug }),
  districtNotFound: (district: string) =>
    new AppError(404, "DISTRICT_NOT_FOUND", "Mapa não encontrado", { district }),
  managerAlreadyHired: (slug: string) =>
    new AppError(409, "MANAGER_ALREADY_HIRED", "Este negócio já tem ajudante", { slug }),
  nothingToCollect: () => new AppError(409, "NOTHING_TO_COLLECT", "Nada pronto para coletar"),
  idempotencyKeyRequired: () =>
    new AppError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Cabeçalho Idempotency-Key obrigatório (8–128 caracteres: letras, números, - ou _)",
    ),
  idempotencyKeyReused: () =>
    new AppError(422, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key já usado com outra requisição"),
};
