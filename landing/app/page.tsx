import Link from "next/link";
import { SITE, STORES } from "@/lib/site";

const FEATURES = [
  {
    emoji: "🌴",
    title: "Comece na praia",
    text: "Um carrinho de água e 100 moedas. Venda, junte e abra pipoca, sorveteria e quiosque de coco.",
  },
  {
    emoji: "🏙️",
    title: "Cresça até a cidade",
    text: "Complete a ilha e libere a cidade: mercadinho, restaurante, supermercado, academia, hotel e shopping.",
  },
  {
    emoji: "🧑‍🍳",
    title: "Contrate ajudantes",
    text: "Cada negócio tem um ajudante que vende sozinho enquanto você está em outro mapa ou fora do jogo (até 4 horas).",
  },
  {
    emoji: "🏆",
    title: "Desafio dos 7 dias",
    text: "Missões diárias, conquistas e um ranking semanal: quem faturar mais até domingo vence.",
  },
];

const FAQ = [
  {
    q: "O jogo é grátis?",
    a: "Sim. Você pode jogar tudo sem pagar. Existem itens opcionais na loja e anúncios que você escolhe assistir em troca de bônus.",
  },
  {
    q: "As moedas e diamantes valem dinheiro?",
    a: "Não. São itens virtuais do jogo, sem valor em dinheiro, sem saque e sem troca por prêmios.",
  },
  {
    q: "Preciso criar conta?",
    a: "Não. O jogo abre direto e salva seu progresso no nosso servidor. No Android, o backup do Google traz o progresso de volta ao reinstalar. Em breve você também poderá vincular sua conta Google ou Apple no Perfil.",
  },
  {
    q: "Precisa de internet?",
    a: "Sim, para salvar e proteger seu progresso. Quando você volta, seus ajudantes entregam o que venderam enquanto você estava fora.",
  },
];

function StoreButton({ store, url }: { store: string; url: string }) {
  if (!url) {
    return (
      <span className="store soon" aria-label={`${store} — em breve`}>
        <small>EM BREVE NA</small>
        <strong>{store}</strong>
      </span>
    );
  }
  return (
    <a className="store" href={url} rel="noopener">
      <small>DISPONÍVEL NA</small>
      <strong>{store}</strong>
    </a>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>{SITE.name}</h1>
            <p className="lead">{SITE.tagline}</p>
            <div className="stores">
              <StoreButton store="Google Play" url={STORES.googlePlay} />
              <StoreButton store="App Store" url={STORES.appStore} />
            </div>
          </div>
          <div className="phone">
            <img
              src="/img/jogo-praia.webp"
              alt="Tela real do jogo: a ilha da praia com o carrinho de água, personagens e os próximos negócios"
              width={540}
              height={1200}
            />
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <h2>Do carrinho ao shopping</h2>
          <p className="sub">
            Um jogo de construir negócios para jogar em poucos minutos por dia, no seu ritmo.
          </p>
          <div className="cards">
            {FEATURES.map((f) => (
              <article className="card" key={f.title}>
                <div className="emoji" aria-hidden>
                  {f.emoji}
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="block alt" id="como-jogar">
        <div className="wrap">
          <h2>Como jogar</h2>
          <p className="sub">Três passos para começar o seu império.</p>
          <ol className="steps">
            <li>
              <strong>Compre o carrinho de água</strong> com as 100 moedas iniciais.
            </li>
            <li>
              <strong>Toque na moeda</strong> quando a venda terminar e melhore o carrinho para lucrar mais.
            </li>
            <li>
              <strong>Contrate ajudantes</strong> e abra novos negócios até chegar à cidade.
            </li>
          </ol>
        </div>
      </section>

      <section className="block" id="perguntas">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2>Perguntas frequentes</h2>
          <p className="sub">
            Mais respostas na página de <Link href="/suporte/">suporte</Link>.
          </p>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
