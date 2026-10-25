import type { Metadata } from "next";
import Link from "next/link";
import { Company } from "@/components/Company";
import { Legal } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Suporte",
  description: "Ajuda e contato do Império de Bolso.",
};

const FAQ = [
  {
    q: "Troquei de celular ou reinstalei o jogo. Perdi o progresso?",
    a: "No Android, se o backup do Google estiver ligado, o progresso volta sozinho ao reinstalar. Em breve você também poderá vincular sua conta Google ou Apple no Perfil para recuperar em qualquer aparelho. Se não conseguir, fale com a gente informando o Código do jogador antigo, se tiver.",
  },
  {
    q: "Onde encontro o Código do jogador?",
    a: "No jogo, toque em Perfil: o código aparece logo abaixo do seu nome.",
  },
  {
    q: "Fiz uma compra e não recebi.",
    a: "Abra a Loja e toque em Restaurar compras. Se não resolver, envie o Código do jogador e o número do pedido da Google Play ou App Store.",
  },
  {
    q: "Assisti um anúncio e não ganhei o bônus.",
    a: "O bônus só é liberado quando a rede de anúncios confirma a exibição completa. Tente de novo; se repetir, fale com a gente.",
  },
  {
    q: "Como cancelo o Passe VIP?",
    a: "Assinaturas são canceladas na loja: Google Play → Pagamentos e assinaturas → Assinaturas, ou iPhone → Ajustes → seu nome → Assinaturas.",
  },
  {
    q: 'Mostra "Sem conexão com o servidor".',
    a: "O jogo precisa de internet. Confira sua conexão e toque em Tentar novamente. Seu progresso fica salvo no servidor.",
  },
];

export default function Suporte() {
  return (
    <Legal title="Suporte">
      <p>
        Precisa de ajuda? Escreva para <Company field="email" /> e informe o{" "}
        <strong>Código do jogador</strong> (Perfil do jogo). Respondemos em até
        2 dias úteis.
      </p>
      <h2>Perguntas frequentes</h2>
      {FAQ.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
      <h2>Links úteis</h2>
      <ul>
        <li>
          <Link href="/excluir-conta/">Excluir minha conta</Link>
        </li>
        <li>
          <Link href="/privacidade/">Política de Privacidade</Link>
        </li>
        <li>
          <Link href="/termos/">Termos de Uso</Link>
        </li>
      </ul>
    </Legal>
  );
}
