import { COMPANY } from "@/lib/site";

/** Valor da empresa; pendências aparecem destacadas (e o build de produção recusa). */
export function Company({ field }: { field: keyof typeof COMPANY }) {
  const value = COMPANY[field];
  if (value === "PENDENTE") return <span className="pending">[{field} pendente]</span>;
  if (field === "email") return <a href={`mailto:${value}`}>{value}</a>;
  return <>{value}</>;
}
