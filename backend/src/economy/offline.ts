// Liquidação de produção automática (com ajudante) — docs/README.md §7:
//   tempo  = clamp(hora_servidor − ultima_liquidacao, 0, 4h)
//   ciclos = floor((tempo + sobra) / duracao_ciclo)
// A sobra (carry) guarda o pedaço de ciclo já produzido para a próxima liquidação.
// Só o relógio do servidor entra aqui; relógio "voltando" vira tempo zero.

export const OFFLINE_CAP_MS = 4 * 60 * 60 * 1000;

export interface SettlementInput {
  now: Date;
  lastSettlementAt: Date;
  carryMs: number;
  cycleSeconds: number;
  capMs?: number;
}

export interface SettlementResult {
  cycles: number;
  carryMs: number;
  /** Tempo considerado (após o limite), em ms. */
  elapsedMs: number;
  /** true se o tempo real passou do limite e parte foi descartada. */
  capped: boolean;
}

export function settle(input: SettlementInput): SettlementResult {
  const cap = input.capMs ?? OFFLINE_CAP_MS;
  const cycleMs = input.cycleSeconds * 1000;
  if (!Number.isInteger(cycleMs) || cycleMs <= 0) throw new RangeError("ciclo inválido");

  const raw = input.now.getTime() - input.lastSettlementAt.getTime();
  const elapsedMs = Math.min(Math.max(raw, 0), cap);
  // A sobra nunca passa de um ciclo (protege contra dados inconsistentes).
  const carry = Math.min(Math.max(Math.trunc(input.carryMs), 0), cycleMs);
  const total = elapsedMs + carry;
  const cycles = Math.floor(total / cycleMs);
  return { cycles, carryMs: total - cycles * cycleMs, elapsedMs, capped: raw > cap };
}
