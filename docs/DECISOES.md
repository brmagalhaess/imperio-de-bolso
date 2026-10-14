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
| [0013](ADRs/0013-aceleradores-velocidade.md) | Aceleradores somados: ajudante +25%, marcos de nível +50%, VIP +50%, Turbo 2×; produção medida em "trabalho" | aceita |
| [0014](ADRs/0014-retencao-diario-ligas-evento.md) | Retenção: missões por fase, calendário de 7 dias, baú das missões, ligas semanais, ranking de estrelas e evento de fim de semana | aceita |
| [0015](ADRs/0015-contas-vinculadas.md) | Contas vinculadas Google/Apple (verificação de ID token no servidor, só o `sub`) e iPad | aceita (login nativo pendente) |
| [0016](ADRs/0016-mapas-5-a-8.md) | Mapas 5–8 (46 negócios) e fórmulas de economia em inteiros exatos com teto 9×10^18 | aceita |
| [0017](ADRs/0017-podio-semanal.md) | Pódio semanal: prêmios de 1º/2º/3º no ranking geral e na liga, entregues com aviso; prestígio não tira do ranking | aceita |
| [0018](ADRs/0018-versao-1-sem-dinheiro-real.md) | Versão 1.0 nas lojas sem dinheiro real e sem anúncios (`PURCHASES_ENABLED`/`ADS_ENABLED`) | aceita |
