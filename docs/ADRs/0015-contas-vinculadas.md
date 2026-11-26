# ADR 0015 — Contas vinculadas (Google/Apple) e versão para iPad

- **Status:** aceita (servidor e tela prontos; login nativo pendente das contas das lojas) ·
  2026-10-14
- **Fonte:** ADR 0009 (convidado + vincular aprovado), pedido do titular ("faltou vincular à
  Apple no iPhone e ao Google no Android; faltou a versão para iPad").

## Decisões

- A conta continua sendo a **convidada**; vincular guarda só o `sub` do provedor
  (`player_identities`, sem e-mail nem nome — LGPD).
- **Verificação no servidor** do ID token (RS256/ES256, JWKS do Google/Apple, emissor, público e
  validade) com `node:crypto` (`lib/id-token.ts`). Públicos aceitos por ambiente:
  `GOOGLE_CLIENT_IDS`, `APPLE_AUDIENCES`; vazio = vínculo desligado (503).
- **Recuperar em outro aparelho:** `POST /auth/social` devolve a conta ligada com um segredo novo
  de convidado — o aparelho antigo deixa de entrar sozinho (evita duas cópias jogando).
- **Jogo:** Perfil → "Salvar progresso" (Google no Android, Apple no iOS); até existir o plugin
  nativo, o botão avisa "Em breve".
- **iPad:** exportação iOS para iPhone e iPad (`targeted_device_family=2`), só retrato, tela
  cheia (`UIRequiresFullScreen`); a interface já se adapta à proporção 3:4.

## Pendências

- Plugin nativo: Android (Credential Manager / Sign in with Google) com client id do Google
  Cloud ligado ao SHA-1 da chave de assinatura; iOS (AuthenticationServices) com a capacidade
  "Sign in with Apple" no time da CROWN TECH. Depois disso preencher as variáveis no Dokploy.
