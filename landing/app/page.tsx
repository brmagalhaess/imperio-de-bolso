import Link from "next/link";
import { SITE, STORES } from "@/lib/site";

const MAPS = [
  "Ilha da Praia",
  "Cidade",
  "Porto da Marina",
  "Centro Financeiro",
  "Polo Industrial",
  "Serra Nevada",
  "Ilha Paraíso",
  "Centro Espacial",
];

const FEATURES = [
  {
    icon: "/img/ui/icon_map.webp",
    title: "8 mapas para conquistar",
    text: "Da praia ao centro espacial: cada mapa traz negócios novos, uma ilha de expansão e prédios que evoluem até o nível 100.",
  },
  {
    icon: "/img/ui/icon_helpers.webp",
    title: "Ajudantes em todas as cidades",
    text: "Contrate um ajudante para cada negócio: ele vende sozinho enquanto você joga em outro mapa ou fica fora do jogo.",
  },
  {
    icon: "/img/ui/status_turbo.webp",
    title: "Turbo e Dobro de moedas",
    text: "O Turbo deixa a produção mais rápida; o Dobro faz cada coleta valer o dobro. Juntos, o império dispara.",
  },
  {
    icon: "/img/ui/offer_investidor.webp",
    title: "Ofertas da semana",
    text: "Três pacotes novos toda segunda-feira e pacotes especiais nos feriados — Natal, Black Friday, Carnaval e mais.",
  },
  {
    icon: "/img/ui/offer_lenda.webp",
    title: "Ranking e ligas",
    text: "Missões diárias, conquistas, evento de fim de semana e ligas Bronze, Prata, Ouro, Platina e Diamante.",
  },
  {
    icon: "/img/ui/offer_tesouro_real.webp",
    title: "Venda o império",
    text: "Chegou ao topo? Venda tudo, ganhe estrelas de investidor e recomece com lucro maior para sempre.",
  },
];

const SHOTS = [
  ["01_praia", "A Ilha da Praia com os primeiros negócios"],
  ["02_cidade", "A Cidade, com mercadinho, restaurante e shopping"],
  ["03_mapas", "Os 8 mapas do jogo"],
  ["04_missoes", "Missões diárias e baú de prêmios"],
  ["05_loja", "A Loja com auto-coleta, turbo e diamantes"],
  ["06_diario", "O prêmio diário de 7 dias"],
  ["07_espaco", "O Centro Espacial, o último mapa"],
  ["08_serra", "A Serra"],
];

const FAQ = [
  {
    q: "O jogo é grátis?",
    a: "Sim. Dá para jogar tudo sem pagar. Existem itens opcionais na Loja — pacotes de diamantes, ofertas da semana, Dobro de moedas e o Passe VIP mensal — pagos pela sua conta da App Store.",
  },
  {
    q: "As moedas e diamantes valem dinheiro?",
    a: "Não. São itens virtuais do jogo, sem valor em dinheiro, sem saque e sem troca por prêmios.",
  },
  {
    q: "Preciso criar conta?",
    a: "Não. O jogo abre direto e salva seu progresso no nosso servidor. No iPhone, em Perfil → Salvar progresso, você vincula sua conta Apple e recupera o jogo em outro aparelho.",
  },
  {
    q: "Os ajudantes trabalham quando estou fora?",
    a: "Sim, em todas as cidades: eles vendem por até 4 horas enquanto você está fora, e o resumo ao abrir o jogo mostra o que cada um vendeu. Com a auto-coleta, todas as cidades rendem enquanto você joga.",
  },
  {
    q: "Como cancelo o Passe VIP?",
    a: "Nos Ajustes do iPhone → seu nome → Assinaturas, ou pelo botão “Gerenciar assinatura” na Loja do jogo. A renovação é automática até você cancelar.",
  },
  {
    q: "Precisa de internet?",
    a: "Sim, para salvar e proteger seu progresso. Quando você volta, seus ajudantes entregam o que venderam enquanto você estava fora.",
  },
];

function AppStoreButton() {
  if (!STORES.appStore) return null;
  return (
    <a className="btn-store" href={STORES.appStore} rel="noopener">
      <svg viewBox="0 0 24 24" aria-hidden width="26" height="26">
        <path
          fill="currentColor"
          d="M12 3a1 1 0 0 1 1 1v9.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V4a1 1 0 0 1 1-1Zm-7 15a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
        />
      </svg>
      <span>
        <small>Baixar grátis na</small>
        <strong>App Store</strong>
      </span>
    </a>
  );
}

function GooglePlayButton() {
  if (STORES.googlePlay) {
    return (
      <a className="btn-store light" href={STORES.googlePlay} rel="noopener">
        <span>
          <small>Disponível no</small>
          <strong>Google Play</strong>
        </span>
      </a>
    );
  }
  return (
    <span className="btn-store soon" aria-label="Google Play — em breve">
      <span>
        <small>Em breve no</small>
        <strong>Google Play</strong>
      </span>
    </span>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="wrap hero-grid">
          <div className="hero-text">
            <span className="pill">Novo · Grátis para iPhone</span>
            <h1>
              Do carrinho de água ao <em>império</em>.
            </h1>
            <p className="lead">{SITE.tagline}</p>
            <div className="stores">
              <AppStoreButton />
              <GooglePlayButton />
            </div>
            <ul className="chips" aria-label="Destaques">
              <li>8 mapas</li>
              <li>67 negócios</li>
              <li>Português · English · Español</li>
            </ul>
          </div>
          <div className="hero-art">
            <div className="device">
              <img
                src="/img/telas/01_praia.webp"
                alt="Tela real do jogo: a Ilha da Praia com os negócios, personagens e as ofertas"
                width={540}
                height={1174}
              />
            </div>
            <img className="float f1" src="/img/ui/status_double.webp" alt="" width={96} height={96} />
            <img className="float f2" src="/img/ui/offer_natal.webp" alt="" width={96} height={96} />
            <img className="float f3" src="/img/ui/status_turbo.webp" alt="" width={84} height={84} />
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <h2>Um império que cabe no bolso</h2>
          <p className="sub">Jogue poucos minutos por dia, no seu ritmo — o império cresce mesmo quando você sai.</p>
          <div className="features">
            {FEATURES.map((f) => (
              <article className="feature" key={f.title}>
                <img src={f.icon} alt="" width={72} height={72} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="block shots-block" aria-label="Telas do jogo">
        <div className="wrap">
          <h2>Veja o jogo</h2>
          <p className="sub">Telas reais, direto do iPhone. Deslize para ver mais.</p>
        </div>
        <div className="shots">
          {SHOTS.map(([file, alt]) => (
            <figure key={file}>
              <img src={`/img/telas/${file}.webp`} alt={alt} width={540} height={1174} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      <section className="block alt" id="como-jogar">
        <div className="wrap">
          <h2>Como jogar</h2>
          <p className="sub">Três passos para começar o seu império.</p>
          <ol className="steps">
            <li>
              <span>1</span>
              <strong>Abra o carrinho de água</strong> com as moedas iniciais e toque na moeda a
              cada venda.
            </li>
            <li>
              <span>2</span>
              <strong>Melhore e contrate ajudantes</strong> para vender sozinho e abrir novos
              negócios.
            </li>
            <li>
              <span>3</span>
              <strong>Libere os 8 mapas</strong> — {MAPS.join(", ")}.
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

      <section className="cta">
        <div className="wrap cta-inner">
          <img src="/img/icone.png" alt="" width={96} height={96} />
          <div>
            <h2>Comece agora o seu império</h2>
            <p>Grátis, sem cadastro. Seu progresso fica salvo.</p>
          </div>
          <div className="stores">
            <AppStoreButton />
          </div>
        </div>
      </section>
    </>
  );
}
