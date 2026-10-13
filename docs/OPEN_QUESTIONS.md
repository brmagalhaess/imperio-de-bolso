# Perguntas em aberto

Dúvidas que não bloqueiam o trabalho atual. Bloqueios reais ficam em `IMPLEMENTATION_STATUS.md`.

1. **Arte Higgsfield:** geração pela API (US$0,06/imagem no Ideogram 4.0). Falta confirmar os
   termos de uso comercial das imagens geradas via API e decidir se os originais (69 MB) vão
   para Git LFS (não instalado nesta máquina).
2. **Bundle ID / package name:** provisório `br.com.imperiodebolso.game`. Confirmar titularidade
   do domínio `imperiodebolso.com.br` (usado também em api./admin./www.).
3. **Nome do jogador:** hoje gerado ("Empreendedor 1234"). Permitir edição? Moderação de nomes?
4. **Credencial convidada no aparelho:** guardada em `user://session.cfg` (sandbox do app).
   Avaliar Keychain/Keystore antes do lançamento e o fluxo `POST /auth/link`.
5. **Custo operacional:** catálogo usa custo operacional 0 (lucro = receita). Definir no
   balanceamento se haverá custo separado.
6. **Vulnerabilidades npm:** `npm audit` aponta `mysql2` (dependência interna da CLI do Prisma 7).
   Não usamos MySQL; não há caminho de execução. Reavaliar ao sair o Prisma 8 estável.
7. **Node 24 LTS:** máquina usa Node 22.14 (compatível). Atualizar quando conveniente.
8. **Repositório:** o README original diz que o remote não estava confirmado — confirmado:
   `github.com/brmagalhaess/imperio-de-bolso` (privado).
9. **Preços da Loja em diamantes** (auto-coleta 20/100, turbo 10/30) e **benefícios do VIP**
   (hoje: auto-coleta em todos os mapas + selo) — proposta do ADR 0008, aguardando o titular.
10. **Ranking por faturamento semanal** (ADR 0007) e **prêmio das missões** (~15 min de renda +
    1 diamante) — propostos, aguardando confirmação.
