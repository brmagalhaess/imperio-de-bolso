# ADR 0005 — Ajudantes, produção offline e tutorial (Etapa 2)

- **Status:** aceita · 2026-10-13
- **Fontes:** docs/README.md §2, §3, §7, §8, §18; PROMPT_MESTRE (Etapa 2); conversa original
  ("contratar ajudantes", "produz dinheiro inclusive enquanto você está fora, com limites").

## Decisão

- **Ajudante = gerente da doc.** Nome "ajudante" vem da conversa original; no código e no banco
  continua `manager`. Um por negócio, comprado com moedas (`POST /managers/hire`).
- **Preço (decisão nova, a doc não define):** ~4× o preço do negócio, em `business_definitions.manager_cost`
  (água: 150, para caber no tutorial). Ajustável no catálogo.
- **Liquidação (§7):** `tempo = clamp(agora − última, 0, 4h)`, `ciclos = floor((tempo + sobra) / ciclo)`,
  sobra em ms (`carry_ms`). Função pura `economy/offline.ts`, testada por propriedade.
  Executada em `POST /production/settle` (abrir, voltar do segundo plano, a cada 15 s), ao
  contratar (paga o ciclo manual pronto) e antes de melhorar (paga no nível antigo).
  Mesma transação, lock da carteira, ledger `production_auto` e Idempotency-Key.
- **Relógio:** só o do servidor; tempo negativo vira zero; o cliente nunca envia tempo.
- **Coleta manual** ignora negócios com ajudante (`409 MANAGER_ACTIVE` se pedida por slug).
- **Resumo offline (§8):** se a liquidação na volta cobre ≥ 60 s, o jogo mostra
  "Bem-vindo de volta!" com o total (já creditado pelo servidor) e avisa quando bateu o teto de 4h.
- **Tutorial (§2, < 5 min):** comprar → coletar → melhorar → contratar ajudante. Passo deduzido do
  estado do servidor (nada no aparelho); conclusão/pular em `POST /tutorial/complete`
  (`players.tutorial_completed_at`, base do evento `tutorial_completed` da §13).
- **Reconexão:** falha de rede marca o jogo como offline, mostra "Sem conexão · reconectando…" e
  tenta de novo a cada 5 s; comandos repetem com a mesma Idempotency-Key.

## Fora desta etapa (como combinado)

- "Assistir anúncio para dobrar os ganhos offline" (conversa original) → Etapa 4 (sandbox).
- Missões, conquistas e ranking → Etapa 3.
