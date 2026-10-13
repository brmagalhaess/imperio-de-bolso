import type { Metadata } from "next";
import Link from "next/link";
import { Company } from "@/components/Company";
import { Legal } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Império de Bolso coleta, usa e protege seus dados (LGPD).",
};

export default function Privacidade() {
  return (
    <Legal title="Política de Privacidade">
      <p>
        Esta política explica quais dados o jogo <strong>Império de Bolso</strong> (aplicativo para
        Android e iPhone, e este site) trata, para quê, por quanto tempo e quais são os seus
        direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD) e o Marco
        Civil da Internet (Lei 12.965/2014).
      </p>

      <h2>1. Quem é o responsável</h2>
      <p>
        O controlador dos dados é <Company field="legalName" />, inscrita no CNPJ{" "}
        <Company field="cnpj" />, com sede em <Company field="city" />. Para qualquer assunto de
        privacidade, inclusive falar com o encarregado de dados, escreva para{" "}
        <Company field="email" />.
      </p>

      <h2>2. O resumo</h2>
      <ul>
        <li>Você não precisa informar nome, e-mail ou telefone para jogar.</li>
        <li>Guardamos o seu progresso no jogo, ligado a um identificador aleatório da conta.</li>
        <li>Não vendemos seus dados e não coletamos localização, contatos, fotos ou microfone.</li>
        <li>
          Você pode apagar a sua conta a qualquer momento pelo próprio jogo ou{" "}
          <Link href="/excluir-conta/">por esta página</Link>.
        </li>
      </ul>

      <h2>3. Dados que tratamos</h2>
      <table>
        <thead>
          <tr>
            <th>Dado</th>
            <th>Para quê</th>
            <th>Base legal (LGPD, art. 7º)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Identificadores da conta</strong>: código aleatório da conta e uma credencial de
              convidado gerada no aparelho (no servidor guardamos só uma versão protegida por hash).
            </td>
            <td>Reconhecer a sua conta e salvar o seu progresso.</td>
            <td>Execução do contrato (fornecer o jogo).</td>
          </tr>
          <tr>
            <td>
              <strong>Progresso do jogo</strong>: negócios, níveis, ajudantes, moedas e diamantes
              virtuais, missões, conquistas e o histórico dessas movimentações.
            </td>
            <td>Funcionamento do jogo, proteção contra trapaça e correção de erros.</td>
            <td>Execução do contrato; legítimo interesse (segurança).</td>
          </tr>
          <tr>
            <td>
              <strong>Nome de exibição</strong>: criado automaticamente (ex.: &quot;Empreendedor
              123&quot;) ou escolhido por você.
            </td>
            <td>Aparece publicamente no ranking semanal.</td>
            <td>Execução do contrato.</td>
          </tr>
          <tr>
            <td>
              <strong>Dados de uso</strong>: ações dentro do jogo (telas abertas, compras com moedas,
              missões concluídas) e se o jogo está aberto, ligados ao identificador da conta — sem
              nome, e-mail ou telefone.
            </td>
            <td>Equilibrar o jogo, medir o que funciona e corrigir problemas.</td>
            <td>Legítimo interesse.</td>
          </tr>
          <tr>
            <td>
              <strong>Registros de acesso</strong>: endereço IP, data e hora das conexões aos nossos
              servidores.
            </td>
            <td>
              Segurança, limite de acessos contra abuso e cumprimento do Marco Civil da Internet
              (art. 15).
            </td>
            <td>Obrigação legal; legítimo interesse.</td>
          </tr>
          <tr>
            <td>
              <strong>Compras</strong> (quando disponíveis): identificador da transação e do produto
              informado pela Google Play ou App Store. Não recebemos dados de cartão nem de
              pagamento.
            </td>
            <td>Entregar o que foi comprado, restaurar compras e tratar reembolsos.</td>
            <td>Execução do contrato; obrigação legal.</td>
          </tr>
          <tr>
            <td>
              <strong>Anúncios recompensados</strong> (quando disponíveis, sempre opcionais): o
              Google AdMob pode tratar o identificador de publicidade e dados técnicos do aparelho.
            </td>
            <td>Exibir o anúncio que você escolheu assistir e confirmar a recompensa.</td>
            <td>
              Consentimento, quando exigido (anúncios personalizados); legítimo interesse (medição
              e prevenção de fraude).
            </td>
          </tr>
          <tr>
            <td>
              <strong>Conta Google ou Apple</strong> (opcional, quando você escolher vincular):
              identificador da conta no provedor e, se fornecido, e-mail.
            </td>
            <td>Recuperar o seu progresso em outro aparelho.</td>
            <td>Execução do contrato.</td>
          </tr>
        </tbody>
      </table>
      <p>
        No Android, a credencial de convidado também é incluída no backup automático do Google
        (criptografado e ligado à sua conta Google), para o progresso voltar se você reinstalar o
        jogo. Você controla esse backup nas configurações do Android.
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li>
          <strong>Provedores de infraestrutura</strong> que hospedam nossos servidores e cópias de
          segurança, sob contrato e só para operar o serviço.
        </li>
        <li>
          <strong>Google</strong> (Google Play, backup do Android, AdMob, login com Google) e{" "}
          <strong>Apple</strong> (App Store, login com Apple), conforme as políticas de privacidade
          de cada um.
        </li>
        <li>Autoridades, somente quando houver obrigação legal ou ordem judicial.</li>
      </ul>
      <p>
        Alguns desses provedores podem tratar dados fora do Brasil. Nesses casos, a transferência
        segue o art. 33 da LGPD, com garantias contratuais de proteção.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e do jogo: enquanto a conta existir.</li>
        <li>
          Ao excluir a conta, os dados são apagados imediatamente do banco de dados. As cópias de
          segurança criptografadas são substituídas em até 14 dias.
        </li>
        <li>Registros de acesso (IP, data e hora): 6 meses, como exige o Marco Civil da Internet.</li>
        <li>
          Registros de compras: mantidos sem ligação com a sua pessoa, pelo prazo exigido em lei e
          para impedir o reuso do mesmo comprovante e tratar reembolsos.
        </li>
      </ul>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode pedir, a qualquer momento e sem custo: confirmação de que tratamos seus dados,
        acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre
        compartilhamentos e revogação do consentimento (LGPD, art. 18). Responda pelo e-mail{" "}
        <Company field="email" /> informando o <strong>Código do jogador</strong> (Perfil do jogo).
        Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de
        Dados (ANPD).
      </p>

      <h2>7. Crianças e adolescentes</h2>
      <p>
        O jogo não é direcionado a crianças menores de 13 anos e não pede dados que identifiquem o
        jogador. Se você é responsável por uma criança e acredita que ela usou o jogo, escreva para{" "}
        <Company field="email" /> que excluímos a conta.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Toda a comunicação usa conexão criptografada (HTTPS). Credenciais são guardadas com hash,
        o acesso aos servidores é restrito e as cópias de segurança são criptografadas. Nenhum
        sistema é totalmente imune a falhas; se houver um incidente relevante, avisaremos os
        afetados e a ANPD conforme a lei.
      </p>

      <h2>9. Mudanças nesta política</h2>
      <p>
        Podemos atualizar esta política. A data no topo indica a versão atual; mudanças importantes
        também serão avisadas dentro do jogo.
      </p>
    </Legal>
  );
}
