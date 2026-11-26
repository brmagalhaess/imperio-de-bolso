# ADR 0020 — Mapas maiores, 5 evoluções e denúncia no ranking

- **Status:** aceita · 2026-10-15
- **Contexto:** a simulação (`backend/scripts/simulate-player.ts`) mostrou o império completo em
  7–11 dias e o titular pediu mapas maiores e mais evoluções visuais (só havia 10 e 25).

## Decisões

- **5 visuais por negócio**: níveis 1, 10, 25, 50 e 100 (`Layout.VISUAL_TIERS`). Sem a arte de uma
  faixa o jogo usa a anterior.
- **Mapas 2–8 com 9 negócios** (67 no total): 3 novos por mapa, com custo/receita/ciclo entre os
  vizinhos. Ficam numa **ilha de expansão** abaixo do mapa, ligada por ponte; o mapa ganha
  arrastar (vertical) e pinça (até 1,8×), e escolher um negócio da ilha leva a câmera até ele.
- **Receita por nível 1,10** (era 1,12): império completo em ~17 dias (engajado) a ~30 (casual).
- **Denúncia de nome** (diretriz 1.2 da Apple): tocar num jogador do ranking → denunciar ou ocultar
  (oculto fica só no aparelho). 3 denunciantes diferentes devolvem o nome escolhido ao padrão.
- Arte: Higgsfield (`tools/art/jobs/v5-*.json`, `v6-*.json`), ilhas em
  `tools/art/process_expansions.py`, lotes achados por `tools/art/find_lots.py`.
