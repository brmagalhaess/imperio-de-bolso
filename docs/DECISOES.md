# Decisões

Índice das decisões de arquitetura (detalhes em `docs/ADRs/`).

| ADR | Decisão | Status |
|---|---|---|
| [0001](ADRs/0001-monorepo-e-stack.md) | Monorepo; Godot 4.7 GL Compatibility; Node/Fastify/Prisma 7/PostgreSQL; testes com banco real | aceita |
| [0002](ADRs/0002-economia-autoritativa.md) | Economia no servidor: BIGINT, lock por carteira, ledger, Idempotency-Key, relógio do servidor | aceita |
| [0003](ADRs/0003-ciclo-manual-e-gerentes.md) | Sem gerente: 1 ciclo pronto aguardando coleta; gerente liquida offline até 4h | aceita |
| [0004](ADRs/0004-direcao-visual-v2.md) | Direção visual v2: Ilha da Praia cartoon (mockups A+B), depois Cidade-maquete (D) | aceita |
| [0005](ADRs/0005-ajudantes-offline-tutorial.md) | Ajudantes (gerentes), liquidação offline 4h no servidor, resumo offline, tutorial deduzido do estado | aceita |
| [0006](ADRs/0006-afk-por-mapa.md) | AFK por mapa (4h cada), coleta manual no mapa aberto; auto-coleta e pacotes de horas na Loja | aceita |
| [0007](ADRs/0007-retencao-missoes-ranking-admin.md) | Missões diárias, conquistas, ranking semanal por faturamento, analytics e painel admin só leitura | aceita |
| [0008](ADRs/0008-loja-anuncios-compras-sandbox.md) | Loja, anúncios (SSV) e compras em sandbox; mock recusado em produção; plugins verificados e bloqueio explícito | aceita |
| [0009](ADRs/0009-beta-android-seguranca-exclusao.md) | Beta Android: rate limit, backups criptografados, BETA_SANDBOX, conta recuperável (Backup do Android) e exclusão de conta | aceita |
| [0010](ADRs/0010-mapas-porto-centro-trilha.md) | Mapas 3 e 4 (Porto, Centro), 22 negócios, conquistas por mapa e tela de Mapas em trilha com nuvens e "Em breve" | aceita |
| [0011](ADRs/0011-prestigio-vender-imperio.md) | Prestígio "Vender o império": estrelas = √(faturamento ÷ 1 mi), +2%/estrela, libera com a cidade completa | aceita |
| [0012](ADRs/0012-idiomas-en-es.md) | Idiomas en/es: CSV com chave em pt-BR, servidor em pt-BR + `titleTemplate` nas missões, idioma automático ou escolhido nas Configurações | aceita |
