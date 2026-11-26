# Lojas — cadastro, URLs e respostas dos formulários

Respostas preparadas a partir do que o jogo faz hoje (conferir de novo antes de enviar: regras
mudam). Site com as políticas: `landing/` → https://imperio.crowntech.com.br.

## URLs que as lojas pedem

| Item | URL |
|---|---|
| Site / página do app | https://imperio.crowntech.com.br/ |
| Política de privacidade | https://imperio.crowntech.com.br/privacidade/ |
| Termos de uso (EULA) | https://imperio.crowntech.com.br/termos/ |
| Exclusão de conta (Google: "URL de exclusão de conta") | https://imperio.crowntech.com.br/excluir-conta/ |
| Suporte (Apple: "Support URL") | https://imperio.crowntech.com.br/suporte/ |

## Google Play Console — conta de organização (CNPJ)

1. Acesse **https://play.google.com/console/signup** com a conta Google que será dona do app
   (de preferência um e-mail da empresa, não pessoal).
2. Tipo de conta: **"Uma organização ou empresa"**.
3. Informe: razão social, **número D-U-N-S** (o mesmo usado na Apple), endereço, site
   (https://imperio.crowntech.com.br/), e-mail e telefone de contato (públicos na ficha) e
   e-mail/telefone do desenvolvedor (verificados).
4. Pague a taxa única de **US$ 25** e conclua a verificação de identidade da organização
   (pode levar alguns dias).
5. Depois de aprovada: criar o app "Império de Bolso", pacote `br.com.imperiodebolso.game`
   (definitivo — não muda depois), ativar **Play App Signing** e enviar o AAB pela trilha de
   **teste interno**, depois **teste fechado**.

## Google — Segurança dos dados (Data Safety)

- Coleta dados? **Sim.** Compartilha com terceiros? **Não** (provedores que operam o serviço
  não contam como compartilhamento; AdMob passa a contar quando os anúncios reais forem
  ligados — atualizar o formulário nessa hora).
- Criptografia em trânsito: **Sim** (HTTPS). Exclusão de conta: **Sim**, no app e pela URL acima.

| Tipo de dado (Google) | Coletado | Obrigatório | Finalidade |
|---|---|---|---|
| IDs do app/dispositivo ou outros IDs (ID aleatório da conta) | Sim | Sim | Funcionalidade do app, segurança/antifraude |
| Atividade no app → interações (eventos de uso) | Sim | Sim | Análise, funcionalidade |
| Atividade no app → outro conteúdo gerado (nome de exibição) | Sim | Não (é gerado) | Funcionalidade (ranking) |
| Informações financeiras → histórico de compras | Sim (quando IAP ativo) | Não | Funcionalidade (entregar/restaurar compras) |
| Informações pessoais → e-mail | Só se vincular Google/Apple | Não | Gerenciamento de conta |
| Diagnóstico (IP em registros de acesso) | Sim | Sim | Segurança, obrigação legal |

## Google — Outras declarações

- **Anúncios**: "Sim, contém anúncios" só quando o AdMob real for ligado (hoje: modo de teste).
- **Público-alvo**: 13+ (não incluir faixas de crianças → evita o programa "Famílias").
  ⚠️ Decisão do titular registrada em `docs/OPEN_QUESTIONS.md`.
- **Classificação de conteúdo (IARC)**: sem violência, sem conteúdo sexual, sem apostas;
  marcar **compras no app** e **interação entre usuários: não** (o ranking mostra só nomes).
  Itens virtuais não têm valor real nem saque.
- **Acesso ao app**: sem login; todo o app acessível sem credenciais.
- **App de finanças / jogos de azar**: não.

## Apple — App Store Connect

- Conta de organização já ativa. Xcode está ligado só ao **Personal Team** (verificado em
  2026-10-13): adicionar em Xcode → Settings → Accounts o Apple ID que é membro da equipe da
  empresa e conferir que aparece "<Empresa> (Organization)". O Team ID da empresa vai no preset
  iOS do Godot.
- Bundle ID: `br.com.imperiodebolso.game`. Capacidades: In-App Purchase; **Sign in with Apple**
  (obrigatório quando houver login com Google — diretriz 4.8).
- **App Privacy (rótulos de privacidade)**:
  - Identificadores → ID do usuário: vinculado ao usuário, sem rastreamento; finalidade:
    funcionalidade do app.
  - Uso → interação com o produto: vinculado, sem rastreamento; análise.
  - Compras → histórico de compras: vinculado; funcionalidade (quando IAP ativo).
  - Contato → e-mail: só ao vincular com Apple/Google; funcionalidade.
  - Diagnóstico: não (não enviamos relatórios de falha do aparelho).
  - Rastreamento (ATT): **não** enquanto não houver anúncios personalizados; com AdMob real,
    pedir ATT e atualizar.
- Exclusão de conta dentro do app: **Sim** (diretriz 5.1.1(v)) — Perfil → Excluir conta.
- Classificação etária: 9+ ou 12+ conforme o questionário (sem conteúdo sensível; com compras).
- Itens virtuais e assinatura (Passe VIP) só via In-App Purchase da Apple.
