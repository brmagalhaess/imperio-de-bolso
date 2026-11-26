# ADR 0004 — Direção visual v2: Ilha da Praia cartoon

- **Status:** aceita pelo titular · 2026-10-12
- **Substitui:** a arte piloto v1 (grade isométrica de grama/asfalto, estilo semi-realista).

## Contexto

O titular rejeitou a primeira versão ("não tem nada a ver com o que imaginava"). A ideia nasceu
numa conversa com o ChatGPT cujas referências eram Idle Town Billionaire (bairro-maquete com
balões de lucro), SimCity BuildIt/Township (cidade densa e colorida) e cenas cartoon de praia.

## Decisão

- **Estilo:** cartoon vibrante, brilhante, quase 3D, formas arredondadas (padrão de jogos casuais).
- **Alvo visual oficial** (escolhido entre 4 mockups gerados): cena do **mockup A** (ilha de areia
  com lotes de cadeado), interface do **mockup B** (cartões creme, avatar, saldo + renda/s, botões
  Construir/Loja/Mapa/Perfil, bolha de coleta) e, para a evolução, a **cidade-maquete do mockup D**.
  Arquivos: `game/assets/source/mockup_praia/`, `game/assets/source/mockup_cidade/`.
- **Progressão espacial:** o jogador começa na **Ilha da Praia** (4 negócios: Água, Pipoca,
  Sorveteria, Quiosque de Coco — que substitui a "Lanchonete" da doc) e depois libera a
  **Cidade-maquete** (Mercadinho … Shopping). O botão Mapa alterna entre as duas.
- **Tela fixa** (sem arrastar): a ilha preenche a tela 9:16 como nos mockups; câmera com zoom 1,12.
- **Feedback de dinheiro:** bolha de moeda tocável sobre negócios prontos, "+N" subindo ao coletar,
  renda por segundo no topo; clientes andando pela areia.
- **Produção de arte:** Grok Image 2.0 (edição com referência) via API Higgsfield, usando o mockup
  aprovado como referência de estilo e o carrinho aprovado como referência de escala/ângulo.
  O remix do Ideogram falhou com referência de proporção diferente.

## Consequências

- `scripts/city.gd`/`iso.gd` removidos; nova cena: `island.gd`, `business_lot.gd`, `walker.gd`,
  `floating_text.gd`, `layout.gd`, `hud.gd` reescrito. Backend inalterado exceto o slug
  `lanchonete` → `quiosque_coco` (migração `*_quiosque_coco`).
- Arte v1 fica nos originais e no catálogo como **descontinuada**.
- Fonte Fredoka (OFL) embutida em `game/assets/fonts/`.

## Atualização 2026-10-13 — Fase 2 (Cidade)

- Desbloqueio **no servidor**: `business_definitions.district` (praia/cidade); comprar na cidade
  exige possuir os 4 negócios da praia (`409 DISTRICT_LOCKED`); `GET /player/state` informa
  `districts[].unlocked`.
- Jogo: `district_view.gd` genérico (substitui `island.gd`) com planta por distrito em
  `layout.gd`; Mapa troca de distrito com fade; menus Construir/Mapa viraram janela modal no
  padrão do mockup B (`menu_modal.gd`, estilos em `ui_style.gd`).
- Arte da cidade gerada a partir do mockup D; 5 prédios refeitos usando o próprio prédio em
  outro nível como referência (a 1ª referência, o mercadinho, contaminou os outros).
