import { describe, expect, it } from "vitest";
import { OFFLINE_CAP_MS, settle } from "../src/economy/offline.js";

const t0 = new Date("2026-01-01T12:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("liquidação offline (docs/README.md §7)", () => {
  it("ciclos completos e sobra", () => {
    expect(settle({ now: at(25_000), lastSettlementAt: t0, carryMs: 0, cycleSeconds: 10 })).toEqual(
      {
        cycles: 2,
        carryMs: 5_000,
        elapsedMs: 25_000,
        capped: false,
      },
    );
  });

  it("a sobra anterior completa o próximo ciclo", () => {
    const r = settle({ now: at(6_000), lastSettlementAt: t0, carryMs: 5_000, cycleSeconds: 10 });
    expect(r).toMatchObject({ cycles: 1, carryMs: 1_000 });
  });

  it("limite de 4 horas", () => {
    const r = settle({
      now: at(10 * 3_600_000),
      lastSettlementAt: t0,
      carryMs: 0,
      cycleSeconds: 10,
    });
    expect(r.elapsedMs).toBe(OFFLINE_CAP_MS);
    expect(r.cycles).toBe(1_440); // 4h / 10s
    expect(r.capped).toBe(true);
  });

  it("relógio voltando (hora do servidor antes da última liquidação) não gera nada", () => {
    const r = settle({
      now: at(-3_600_000),
      lastSettlementAt: t0,
      carryMs: 2_000,
      cycleSeconds: 10,
    });
    expect(r).toEqual({ cycles: 0, carryMs: 2_000, elapsedMs: 0, capped: false });
  });

  it("sobra inconsistente é limitada a um ciclo", () => {
    const r = settle({ now: t0, lastSettlementAt: t0, carryMs: 999_999, cycleSeconds: 10 });
    expect(r).toMatchObject({ cycles: 1, carryMs: 0 });
  });

  it("propriedade: ciclos × ciclo + sobra = tempo + sobra anterior (abaixo do limite)", () => {
    for (let i = 0; i < 500; i++) {
      const cycleSeconds = 1 + Math.floor(Math.random() * 300);
      const carryMs = Math.floor(Math.random() * cycleSeconds * 1000);
      const elapsed = Math.floor(Math.random() * OFFLINE_CAP_MS);
      const r = settle({ now: at(elapsed), lastSettlementAt: t0, carryMs, cycleSeconds });
      expect(r.cycles * cycleSeconds * 1000 + r.carryMs).toBe(elapsed + carryMs);
      expect(r.carryMs).toBeGreaterThanOrEqual(0);
      expect(r.carryMs).toBeLessThan(cycleSeconds * 1000);
    }
  });
});
