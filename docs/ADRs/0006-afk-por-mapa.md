# ADR 0006 — Produção AFK por mapa; auto-coleta no mapa é item da Loja

- **Status:** aceita · 2026-10-13 (pedido do titular)
- **Substitui em parte:** ADR 0005 (ajudante produzindo sozinho sempre).
- **Desvio consciente da doc:** docs/README.md §3 diz "gerentes automatizam produção e habilitam
  ganhos offline". Por decisão do titular, a automação **no mapa aberto** passa a ser paga (Loja);
  o ajudante habilita a produção **fora do mapa** (AFK).

## Regras

1. **No mapa aberto, coleta manual** (tocar na moeda), mesmo com ajudante.
2. **AFK por mapa:** negócios com ajudante produzem sozinhos enquanto o jogador está em outro
   mapa ou com o jogo fechado, com **teto de 4h por mapa** (contado desde que saiu dele).
3. **Ao entrar no mapa**, o servidor paga o AFK acumulado dele e mostra "Bem-vindo de volta!".
4. **Auto-coleta no mapa aberto:** direito `players.auto_collect` (desligado). Será vendido na
   Loja (Etapa 4) — forma/preço a definir.
5. **Pacotes de horas de coleta** (ex.: "+2h de produção na hora"): item da Loja (Etapa 4).
6. Sem ajudante não há AFK.

## Implementação

- `POST /presence { district }` (Idempotency-Key): o jogo chama ao abrir, ao trocar de mapa e a
  cada 15 s. Presença expira após 45 s sem sinal (`PRESENCE_TIMEOUT_MS`): o AFK começa no último
  sinal. Ao sair de um mapa, os negócios com ajudante dele passam para AFK com o andamento do
  ciclo manual como sobra; ao entrar, paga e volta ao manual continuando o ciclo.
- Negócio "automático" = ajudante + `cycle_started_at` nulo (`isAutomatic`). Coleta manual nele →
  `409 MANAGER_ACTIVE`. Melhorar liquida antes. Fórmula e teto: `economy/offline.ts` (ADR 0005).
- `POST /production/settle` foi removido (substituído por `/presence`).
- Jogo: botão **Ajudantes** na barra (lista do mapa atual: contratar / contratado / travado),
  Mapa mostra o AFK esperando em cada mapa, resumo diz de qual mapa veio.
- Retratos dos ajudantes reaproveitam os personagens; arte própria por negócio e ícone do botão
  ficam como próxima geração de arte (precisa de autorização de custo).
