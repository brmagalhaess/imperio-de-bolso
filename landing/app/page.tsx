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
  "Ilha dos Piratas",
  "Atlântida",
  "Vale dos Dinossauros",
  "Reino dos Pinguins",
  "Cidade dos Doces",
  "Cidade dos Brinquedos",
  "Base Lunar",
  "Colônia em Marte",
  "Planeta dos Gatos",
  "Anéis de Saturno",
  "Planeta Gelatina",
  "Império Galáctico",
];

const FEATURES = [
  {
    icon: "/img/ui/icon_map.webp",
    title: "20 mapas para conquistar",
    text: "Da praia ao império galáctico, passando por piratas, dinossauros, doces, a Lua e Marte: cada mapa traz 12 negócios, duas ilhas de expansão e prédios que evoluem até o nível 100.",
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
  ["03_mapas", "Os mapas do jogo"],
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

/** Selos no padrão das lojas: fundo preto, logo oficial e "Baixar na / Disponível no". */
function AppStoreButton() {
  if (!STORES.appStore) return null;
  return (
    <a
      className="btn-store"
      href={STORES.appStore}
      rel="noopener"
      aria-label="Baixar na App Store"
    >
      <svg viewBox="0 0 384 512" aria-hidden width="28" height="34">
        <path
          fill="currentColor"
          d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        />
      </svg>
      <span>
        <small>Baixar na</small>
        <strong>App Store</strong>
      </span>
    </a>
  );
}

function PlayLogo() {
  // Triângulo colorido do Google Play.
  return (
    <svg viewBox="0 0 48 48" aria-hidden width="30" height="30">
      <path
        fill="#00d7fe"
        d="M7.6 4.3c-.5.5-.8 1.3-.8 2.3v34.8c0 1 .3 1.8.8 2.3l.1.1L27.2 24.3v-.5L7.7 4.2z"
      />
      <path
        fill="#ffce00"
        d="M33.7 30.8l-6.5-6.5v-.5l6.5-6.5.1.1 7.7 4.4c2.2 1.3 2.2 3.3 0 4.6l-7.7 4.4z"
      />
      <path
        fill="#ff3a44"
        d="M33.8 30.7L27.2 24 7.6 43.7c.7.8 1.9.9 3.3.1l22.9-13.1"
      />
      <path
        fill="#48ff48"
        d="M33.8 17.3L10.9 4.3c-1.4-.8-2.6-.7-3.3.1L27.2 24z"
      />
    </svg>
  );
}

function GooglePlayButton() {
  if (STORES.googlePlay) {
    return (
      <a
        className="btn-store"
        href={STORES.googlePlay}
        rel="noopener"
        aria-label="Disponível no Google Play"
      >
        <PlayLogo />
        <span>
          <small>DISPONÍVEL NO</small>
          <strong>Google Play</strong>
        </span>
      </a>
    );
  }
  return (
    <span className="btn-store soon" aria-label="Google Play — em breve">
      <PlayLogo />
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
            <span className="pill">Novo · Grátis para iPhone e Android</span>
            <h1>
              Do carrinho de água ao <em>império</em>.
            </h1>
            <p className="lead">{SITE.tagline}</p>
            <div className="stores">
              <AppStoreButton />
              <GooglePlayButton />
            </div>
            <ul className="chips" aria-label="Destaques">
              <li>20 mapas</li>
              <li>234 negócios</li>
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
            <img
              className="float f1"
              src="/img/ui/status_double.webp"
              alt=""
              width={96}
              height={96}
            />
            <img
              className="float f2"
              src="/img/ui/offer_natal.webp"
              alt=""
              width={96}
              height={96}
            />
            <img
              className="float f3"
              src="/img/ui/status_turbo.webp"
              alt=""
              width={84}
              height={84}
            />
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <h2>Um império que cabe no bolso</h2>
          <p className="sub">
            Jogue poucos minutos por dia, no seu ritmo — o império cresce mesmo
            quando você sai.
          </p>
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
          <p className="sub">
            Telas reais, direto do iPhone. Deslize para ver mais.
          </p>
        </div>
        <div className="shots">
          {SHOTS.map(([file, alt]) => (
            <figure key={file}>
              <img
                src={`/img/telas/${file}.webp`}
                alt={alt}
                width={540}
                height={1174}
                loading="lazy"
              />
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
              <strong>Abra o carrinho de água</strong> com as moedas iniciais e
              toque na moeda a cada venda.
            </li>
            <li>
              <span>2</span>
              <strong>Melhore e contrate ajudantes</strong> para vender sozinho
              e abrir novos negócios.
            </li>
            <li>
              <span>3</span>
              <strong>Libere os 20 mapas</strong> — {MAPS.join(", ")}.
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
            <GooglePlayButton />
          </div>
        </div>
      </section>
    </>
  );
}
