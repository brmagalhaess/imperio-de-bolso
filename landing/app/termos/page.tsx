import type { Metadata } from "next";
import Link from "next/link";
import { Company } from "@/components/Company";
import { Legal } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso do jogo Império de Bolso.",
};

export default function Termos() {
  return (
    <Legal title="Termos de Uso">
      <p>
        Estes termos regem o uso do jogo <strong>Império de Bolso</strong>, oferecido por{" "}
        <Company field="legalName" /> (CNPJ <Company field="cnpj" />). Ao jogar, você concorda com
        eles e com a nossa <Link href="/privacidade/">Política de Privacidade</Link>.
      </p>

      <h2>1. O jogo</h2>
      <p>
        O Império de Bolso é um jogo gratuito de construir negócios, para celulares Android e
        iPhone. Ele precisa de internet: o progresso é salvo e protegido no nosso servidor.
        Podemos melhorar, ajustar ou mudar o jogo ao longo do tempo, inclusive valores de produção
        e preços em moedas virtuais, para manter o equilíbrio.
      </p>

      <h2>2. Sua conta</h2>
      <p>
        O jogo cria uma conta de convidado automaticamente, ligada ao aparelho. Você é responsável
        pelo uso do jogo no seu aparelho. Para não perder o progresso ao trocar de celular, use o
        backup do seu aparelho ou vincule a conta Google ou Apple quando essa opção estiver
        disponível. Você pode excluir a conta a qualquer momento (
        <Link href="/excluir-conta/">veja como</Link>).
      </p>

      <h2>3. Moedas, diamantes e itens virtuais</h2>
      <ul>
        <li>
          Moedas, diamantes, negócios, ajudantes e demais itens são <strong>virtuais</strong>: não
          têm valor em dinheiro, não podem ser sacados, trocados por prêmios ou transferidos para
          outras pessoas.
        </li>
        <li>
          Você recebe uma licença pessoal e limitada para usá-los dentro do jogo; eles não são sua
          propriedade.
        </li>
        <li>
          Não há apostas nem sorteios com dinheiro real no jogo.
        </li>
      </ul>

      <h2>4. Compras</h2>
      <p>
        Itens opcionais (como pacotes de diamantes e o Passe VIP) são vendidos pela Google Play ou
        pela App Store, com os preços mostrados na loja. O pagamento, a renovação e o cancelamento
        de assinaturas e os pedidos de reembolso seguem as regras da loja onde você comprou; você
        pode cancelar uma assinatura a qualquer momento nas configurações da loja. Se uma compra for
        reembolsada, os itens correspondentes podem ser retirados da conta. Seus direitos como
        consumidor previstos no Código de Defesa do Consumidor são preservados.
      </p>

      <h2>5. Anúncios</h2>
      <p>
        O jogo pode oferecer anúncios recompensados, sempre opcionais: você escolhe assistir em
        troca de um bônus. A recompensa só é entregue quando a exibição é confirmada.
      </p>

      <h2>6. Regras de convivência</h2>
      <p>É proibido:</p>
      <ul>
        <li>usar nomes ofensivos, discriminatórios ou que imitem outras pessoas;</li>
        <li>
          trapacear: modificar o aplicativo, automatizar jogadas, explorar falhas ou manipular o
          servidor;
        </li>
        <li>vender, comprar ou trocar contas ou itens virtuais fora do jogo.</li>
      </ul>
      <p>
        Em caso de violação, podemos remover o nome do ranking, corrigir saldos obtidos de forma
        indevida, suspender ou encerrar a conta.
      </p>

      <h2>7. Ranking</h2>
      <p>
        O ranking semanal mostra o nome de exibição e o faturamento no jogo. Ele não dá direito a
        prêmios em dinheiro.
      </p>

      <h2>8. Disponibilidade e responsabilidade</h2>
      <p>
        Trabalhamos para manter o jogo no ar, mas podem ocorrer manutenções e falhas. Na medida
        permitida pela lei, não nos responsabilizamos por perdas decorrentes de indisponibilidade,
        de problemas no seu aparelho ou conexão, ou de uso em desacordo com estes termos.
      </p>

      <h2>9. Propriedade intelectual</h2>
      <p>
        O jogo, a arte, os textos e a marca Império de Bolso pertencem à{" "}
        <Company field="legalName" />. Sons e músicas de terceiros são usados sob licença de domínio
        público (CC0).
      </p>

      <h2>10. Mudanças e contato</h2>
      <p>
        Podemos atualizar estes termos; mudanças importantes serão avisadas no jogo. Dúvidas:{" "}
        <Company field="email" />.
      </p>

      <h2>11. Lei aplicável</h2>
      <p>
        Estes termos seguem as leis do Brasil. Fica eleito o foro do domicílio do consumidor para
        resolver qualquer questão.
      </p>
    </Legal>
  );
}
