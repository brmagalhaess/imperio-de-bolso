# Perguntas em aberto

Dúvidas que não bloqueiam o trabalho atual. Bloqueios reais ficam em `IMPLEMENTATION_STATUS.md`.

1. **Arte Higgsfield:** geração pela API (US$0,06/imagem no Ideogram 4.0). Falta confirmar os
   termos de uso comercial das imagens geradas via API e decidir se os originais (69 MB) vão
   para Git LFS (não instalado nesta máquina).
2. **Bundle ID / package name:** provisório `br.com.imperiodebolso.game`. Confirmar titularidade
   do domínio `imperiodebolso.com.br` (usado também em api./admin./www.).
3. **Nome do jogador:** troca única implementada. Falta moderação manual no painel admin
   (renomear/denunciar nomes) e ampliar a lista de termos bloqueados.
4. **Credencial convidada no aparelho:** guardada em `user://session.cfg` (sandbox do app).
   Avaliar Keychain/Keystore antes do lançamento e o fluxo `POST /auth/link`.
5. **Custo operacional:** catálogo usa custo operacional 0 (lucro = receita). Definir no
   balanceamento se haverá custo separado.
6. **Vulnerabilidades npm:** `npm audit` aponta `mysql2` (dependência interna da CLI do Prisma 7).
   Não usamos MySQL; não há caminho de execução. Reavaliar ao sair o Prisma 8 estável.
7. **Node 24 LTS:** máquina usa Node 22.14 (compatível). Atualizar quando conveniente.
8. **Repositório:** o README original diz que o remote não estava confirmado — confirmado:
   `github.com/brmagalhaess/imperio-de-bolso` (privado).
9. **Preços da Loja em diamantes** (auto-coleta 20/100, coleta antecipada 10/30) e **VIP**
   (auto-coleta em todos os mapas + 5 diamantes/dia + selo) — aguardando o titular.
10. **Ranking por faturamento semanal** (ADR 0007) e **prêmio das missões** (~15 min de renda +
    1 diamante) — propostos, aguardando confirmação.
9. **Público-alvo nas lojas:** proposta 13+ (fora do programa Famílias do Google, que exige
   redes de anúncios certificadas e regras extras). Política de privacidade já diz "não
   direcionado a menores de 13". Confirmar com o titular.
10. **Registros de acesso (Marco Civil, art. 15):** a política promete guardar IP/data/hora por
    6 meses. Hoje os acessos ficam nos logs do nginx-proxy/Docker do servidor, sem rotação
    garantida. Antes do lançamento: log de acesso dedicado (volume, retenção de 6 meses).
11. **Pré-cadastro por e-mail na landing (plano §21):** fica para depois (exige opt-in,
    descadastro e guarda de e-mails). Por ora a landing tem "Em breve" nas lojas.
12. **Nome do jogo em outros idiomas:** hoje "Império de Bolso" em todos. Opções: manter a marca
    ou usar "Pocket Empire" (en) / "Imperio de Bolsillo" (es) no jogo e nas lojas. Decisão do
    titular (verificar disponibilidade do nome nas lojas antes).
