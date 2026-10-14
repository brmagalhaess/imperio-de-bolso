# ADR 0010 — Mapas 3 e 4 (Porto da Marina, Centro Financeiro) e tela de Mapas em trilha

- **Status:** aceita · 2026-10-13
- **Fontes:** pedido do titular ("crie mais uns 2 mapas… trilha com os mapas flutuando na
  vertical… mapas não alcançados escondidos por nuvens… no final um mapa 'Em breve'").
- **Desvio registrado:** novos bairros/negócios eram da Etapa 6 (após o teste fechado) no
  docs/README.md; antecipados a pedido do titular.

## Decisões

- **Mapas:** `porto` (Peixaria, Loja de Surf, Frutos do Mar, Marina, Estaleiro, Terminal de
  Cargas) e `centro` (Joalheria, Banco, Torre de Escritórios, Centro de Convenções, Estádio,
  Aeroporto) — 6 negócios cada, nos 6 lotes das cenas. Abrem em cadeia: completar o mapa
  anterior libera o próximo (servidor genérico por `DISTRICTS`).
- **Economia:** continua a cidade com ~1,7× por negócio (25 mi → 8,5 bi); ajudante ~4× o
  negócio. Teto imposto pela fórmula: custo no nível 100 ≤ inteiro seguro (~9×10^15) — teste
  garante. Conquistas novas: Prefeito da cidade, Capitão do porto, Magnata do centro.
- **Arte (Higgsfield, aprovado até US$ 4; gasto US$ 3,18):** cenas editadas da cidade (mesma
  malha de ruas e lotes), 12 negócios × 3 níveis no estilo da cidade, 12 ajudantes em 2 folhas.
  Prompts em `tools/art/jobs/v3-*.json`.
- **Tela de Mapas:** trilha vertical (`scripts/map_trail.gd`), primeiro mapa embaixo; mapas
  flutuam; bloqueados cobertos por nuvens desenhadas em código (nome oculto "???" e o que
  falta); no topo, cartão "Em breve". Substitui a lista antiga.
