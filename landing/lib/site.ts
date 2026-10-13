// Dados do site e da empresa responsável (controladora dos dados, LGPD).
// Os campos marcados como PENDENTE precisam do titular antes da publicação:
// o build de produção (SITE_STRICT=1, usado no Dockerfile) falha se algum ficar pendente.

const PENDING = "PENDENTE";

export const SITE = {
  name: "Império de Bolso",
  url: "https://imperio.crowntech.com.br",
  tagline: "Comece com um carrinho de água na praia e construa o seu império.",
  description:
    "Jogo de construir negócios para celular: comece com um carrinho de água na praia, " +
    "contrate ajudantes e transforme a ilha em uma cidade inteira. Grátis para Android e iPhone.",
  /** Data da versão atual das políticas (exibida em cada página legal). */
  policiesUpdatedAt: "13 de outubro de 2026",
};

export const COMPANY = {
  /** Razão social exatamente como no CNPJ. */
  legalName: process.env.SITE_LEGAL_NAME ?? PENDING,
  cnpj: process.env.SITE_CNPJ ?? PENDING,
  /** Cidade/UF da sede (foro e identificação). */
  city: process.env.SITE_CITY ?? PENDING,
  /** E-mail de suporte e de privacidade (encarregado de dados). */
  email: process.env.SITE_EMAIL ?? PENDING,
};

export function pendingFields(): string[] {
  return Object.entries(COMPANY)
    .filter(([, v]) => v === PENDING)
    .map(([k]) => k);
}

if (process.env.SITE_STRICT === "1" && pendingFields().length > 0) {
  throw new Error(`Dados da empresa pendentes no site: ${pendingFields().join(", ")}`);
}

export const STORES = {
  // Links reais entram quando o app estiver publicado (antes disso: "Em breve").
  googlePlay: process.env.SITE_GOOGLE_PLAY_URL ?? "",
  appStore: process.env.SITE_APP_STORE_URL ?? "",
};
