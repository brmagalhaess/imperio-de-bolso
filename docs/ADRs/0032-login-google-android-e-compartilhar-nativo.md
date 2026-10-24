# ADR 0032 — Login com Google no Android e compartilhar pela folha nativa

- **Status:** aceita · 2026-10-24
- **Contexto:** no Android o botão "Vincular com o Google" só mostrava "Em breve" (nunca foi
  feito) e o "Compartilhar no Facebook" abria o `facebook.com/sharer`, que o app do Facebook
  intercepta e só abre o feed, sem o post.

## Decisões

- **Login Google:** plugin próprio `ImperioAndroid` (fonte em `tools/android/imperio-plugin`,
  Kotlin, Credential Manager + `GetSignInWithGoogleOption`), AAR em `game/addons/ImperioAndroid`.
  Devolve o ID token com o público do cliente "web" do projeto `imperio-de-bolso-pagamentos`;
  o servidor já valida (issuer accounts.google.com, `GOOGLE_CLIENT_IDS`). Clientes Android com o
  SHA-1 da chave de assinatura do Google Play e da chave de envio. Tela de login do Google
  publicada ("Em produção", escopos básicos).
- **Compartilhar:** o jogo abre `/api/v1/share/rank/:id?s=1`, página que monta a imagem (nome e
  posição) num canvas e chama `navigator.share` com o arquivo — a folha nativa do iPhone e do
  Android (Facebook, WhatsApp, Instagram). Botões de reserva: Facebook, WhatsApp e salvar imagem.
  Sem `s=1` a página só leva ao site (é o link que vai no post, com Open Graph).
