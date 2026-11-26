# ADR 0012 — Idiomas: inglês e espanhol (Etapa 6 · V1.2)

- **Status:** aceita · 2026-10-14
- **Fontes:** docs/README.md (versão completa: idiomas en-US/es-ES), BACKLOG Etapa 6 · V1.2,
  convenção do AGENTS.md (textos via `tr()`, prontos para i18n).

## Decisões

- **Tabela única** `game/i18n/translations.csv` (colunas `keys, pt_BR, en, es`), importada pelo
  Godot; a **chave é o texto em pt-BR**. `tools/i18n/extract.py` varre `tr()` nos scripts, as
  mensagens de erro, títulos dos mapas, textos do tutorial e os catálogos do servidor (negócios,
  missões, conquistas, Loja) e avisa traduções faltando. Os `.translation` são gerados no import
  (não vão para o Git).
- **Servidor continua em pt-BR.** Textos de catálogo servem de chave no cliente. Missões ganham
  `titleTemplate` ("Fature {n} moedas") para o cliente traduzir e formatar o alvo; `title` pronto
  continua (compatibilidade). Códigos de erro já eram estáveis.
- **Configurações → Idioma:** Automático (idioma do aparelho: pt → Português, es → Español,
  qualquer outro → English), Português, English, Español. Escolha salva no aparelho
  (`user://settings.cfg`, seção `ui`); trocar recarrega a cena para todos os textos mudarem.
- **Números no padrão do idioma:** en `1,234,567` / `12.5`; pt e es `1.234.567` / `12,5`.
- **Nome do jogo** fica "Império de Bolso" em todos os idiomas até o titular decidir
  (OPEN_QUESTIONS 12). Arte com texto (placas) continua em português.

## Consequências

- Texto novo na interface: escrever com `tr()`, rodar `python3 tools/i18n/extract.py` e
  preencher en/es no CSV.
- Fichas das lojas em inglês/espanhol e políticas traduzidas ficam para a publicação fora do
  Brasil (não bloqueiam o lançamento no Brasil).
