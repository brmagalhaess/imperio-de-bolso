import type { Metadata } from "next";
import Link from "next/link";
import { Company } from "@/components/Company";
import { Legal } from "@/components/Legal";
import { COMPANY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Excluir conta",
  description:
    "Como excluir sua conta do Império de Bolso e quais dados são apagados.",
};

export default function ExcluirConta() {
  const mail =
    COMPANY.email === "PENDENTE"
      ? undefined
      : `mailto:${COMPANY.email}?subject=${encodeURIComponent("Excluir minha conta - Império de Bolso")}` +
        `&body=${encodeURIComponent("Código do jogador (Perfil do jogo): \nNome no jogo: \n")}`;
  return (
    <Legal title="Excluir sua conta">
      <p>
        Você pode excluir a sua conta do <strong>Império de Bolso</strong> e
        todos os dados do jogo a qualquer momento, de graça.
      </p>

      <h2>Pelo jogo (na hora)</h2>
      <ol>
        <li>
          Abra o jogo e toque em <strong>Perfil</strong> (barra de baixo).
        </li>
        <li>
          No fim da tela, em <strong>Conta</strong>, toque em{" "}
          <strong>Excluir conta</strong>.
        </li>
        <li>
          Digite <strong>EXCLUIR</strong> e toque em{" "}
          <strong>Excluir para sempre</strong>.
        </li>
      </ol>
      <p>A exclusão é imediata e o jogo recomeça do zero com uma conta nova.</p>

      <h2>Sem o jogo instalado</h2>
      <p>
        Envie um e-mail para <Company field="email" /> com o assunto
        &quot;Excluir minha conta&quot; e informe o{" "}
        <strong>Código do jogador</strong> (aparece no Perfil do jogo) ou o seu
        nome no jogo. Fazemos a exclusão em até 15 dias e confirmamos por
        e-mail.
      </p>
      {mail && (
        <p>
          <a className="store" style={{ background: "#d94f4f" }} href={mail}>
            <small>PEDIR POR E-MAIL</small>
            <strong>Excluir minha conta</strong>
          </a>
        </p>
      )}

      <h2>O que é apagado</h2>
      <ul>
        <li>Conta, nome de exibição e posição no ranking;</li>
        <li>negócios, ajudantes, moedas, diamantes, missões e conquistas;</li>
        <li>histórico de movimentações e dados de uso ligados à conta.</li>
      </ul>

      <h2>O que é mantido (e por quanto tempo)</h2>
      <ul>
        <li>
          Cópias de segurança criptografadas: substituídas em até{" "}
          <strong>14 dias</strong>.
        </li>
        <li>
          Registros de acesso (IP, data e hora): <strong>6 meses</strong>, por
          exigência do Marco Civil da Internet.
        </li>
        <li>
          Registros de compras feitas na loja,{" "}
          <strong>sem ligação com você</strong>: pelo prazo legal, para tratar
          reembolsos e impedir reuso de comprovantes. Se você tinha uma
          assinatura ativa, ela continua na loja: cancele nas configurações da
          Google Play ou da App Store.
        </li>
      </ul>
      <p>
        Mais detalhes na{" "}
        <Link href="/privacidade/">Política de Privacidade</Link>.
      </p>
    </Legal>
  );
}
