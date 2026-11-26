// Dinheiro do jogo sem teto (ADR 0033): as colunas de moedas são NUMERIC(65,0) no banco e
// `bigint` no código. O Prisma devolve bigint nas consultas normais; nas consultas diretas
// ($queryRaw) as somas vêm como Decimal — `toBig` converte sem perder dígitos.

export function toBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "string") return BigInt(v.includes(".") ? v.slice(0, v.indexOf(".")) : v);
  if (v && typeof v === "object" && "toFixed" in v && typeof v.toFixed === "function") {
    return BigInt((v as { toFixed(d: number): string }).toFixed(0));
  }
  if (v === null || v === undefined) return 0n;
  return BigInt(String(v));
}
