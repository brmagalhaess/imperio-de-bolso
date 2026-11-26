#!/usr/bin/env node
// Cadastra no Google Play os produtos da Loja (ADR 0028), lendo o catálogo do servidor para não
// divergir: diamantes, Dobro de moedas e os 20 pacotes como produtos de compra única
// (consumíveis — o jogo consome depois que o servidor entrega) e o Passe VIP como assinatura
// mensal (plano base "mensal"). Preço base em BRL igual ao da App Store; o Google converte para
// os outros países. Pode rodar de novo: atualiza o que já existe.
//
//   node tools/android/products_setup.mjs            # cria/atualiza e ativa tudo
//   node tools/android/products_setup.mjs --dry-run  # só mostra o que faria
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { play } from "./play.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = "br.com.imperiodebolso.game";
const P = `/applications/${PKG}`;
let REGIONS = "regionsVersion.version=2022/02"; // trocado pela versão que o Google devolve na conversão
const OPTION = "padrao"; // opção de compra única (compatível com a Billing Library antiga)
const DRY = process.argv.includes("--dry-run");

const NAMES = {
  gems_50: ["Handful of gems", "Puñado de diamantes"],
  gems_120: ["Bag of gems", "Saco de diamantes"],
  gems_300: ["Chest of gems", "Cofre de diamantes"],
  double_1h: ["Double coins for 1 hour", "Monedas dobles por 1 hora"],
  vip_monthly: ["VIP Pass", "Pase VIP"],
  bundle_iniciante: ["Starter Kit", "Kit de Inicio"],
  bundle_combo_turbo: ["Turbo Combo", "Combo Turbo"],
  bundle_empreendedor: ["Entrepreneur Kit", "Kit Emprendedor"],
  bundle_fim_de_semana: ["Weekend Combo", "Combo Fin de Semana"],
  bundle_investidor: ["Investor's Chest", "Cofre del Inversor"],
  bundle_express: ["Empire Express", "Imperio Express"],
  bundle_mala_de_ouro: ["Golden Suitcase", "Maleta de Oro"],
  bundle_magnata: ["Tycoon's Vault", "Bóveda del Magnate"],
  bundle_tesouro_real: ["Royal Treasure", "Tesoro Real"],
  bundle_lenda: ["Pocket Legend", "Leyenda de Bolsillo"],
  bundle_carnaval: ["Carnival Pack", "Paquete de Carnaval"],
  bundle_pascoa: ["Easter Pack", "Paquete de Pascua"],
  bundle_dia_das_maes: ["Mother's Day Pack", "Paquete Día de la Madre"],
  bundle_festa_junina: ["June Festival Pack", "Paquete Fiesta de Junio"],
  bundle_dia_dos_pais: ["Father's Day Pack", "Paquete Día del Padre"],
  bundle_independencia: ["Independence Pack", "Paquete Independencia"],
  bundle_dia_das_criancas: ["Children's Day Pack", "Paquete Día del Niño"],
  bundle_black_friday: ["Black Friday Pack", "Paquete Black Friday"],
  bundle_natal: ["Christmas Pack", "Paquete de Navidad"],
  bundle_ano_novo: ["New Year Pack", "Paquete de Año Nuevo"],
};

function catalog() {
  const js = `Promise.all([import("./src/economy/store.ts"), import("./src/economy/bundles.ts")]).then(([s, b]) => {
    const items = s.STORE_ITEMS.filter((i) => "productId" in i).map((i) => ({ kind: i.kind, productId: i.productId, title: i.title, priceBRL: i.priceBRL, gems: i.gems?.toString(), benefits: i.benefits, hours: i.hours }));
    const bundles = b.BUNDLES.map((x) => ({ kind: "bundle", productId: x.productId, title: x.title, priceBRL: x.priceBRL, gems: x.gems.toString(), auto: x.autoCollectHours, turbo: x.turboHours, boost: x.boostHours }));
    console.log(JSON.stringify([...items, ...bundles]));
  })`;
  return JSON.parse(execFileSync("npx", ["tsx", "-e", js], { cwd: join(ROOT, "backend"), encoding: "utf8" }));
}

const num = (n) => Number(n).toLocaleString("pt-BR");
/** Descrição curta (até 200 caracteres no Google) em pt/en/es. */
function describe(p, lang) {
  const parts = [];
  if (p.gems && p.gems !== "0") parts.push({ pt: `${num(p.gems)} diamantes`, en: `${num(p.gems)} gems`, es: `${num(p.gems)} diamantes` }[lang]);
  if (p.auto) parts.push({ pt: `auto-coleta ${p.auto} h`, en: `auto-collect ${p.auto} h`, es: `autorecogida ${p.auto} h` }[lang]);
  if (p.turbo) parts.push(`turbo ${p.turbo} h`);
  if (p.boost) parts.push({ pt: `${p.boost} h de produção`, en: `${p.boost} h of income`, es: `${p.boost} h de producción` }[lang]);
  if (p.kind === "double") return { pt: "Cada coleta vale o dobro por 1 hora, em todas as cidades.", en: "Every collection is worth double for 1 hour, in every city.", es: "Cada recolección vale el doble durante 1 hora, en todas las ciudades." }[lang];
  return parts.join(" + ") || p.title;
}

function money(brl) {
  const [units, cents = "0"] = brl.split(",");
  return { currencyCode: "BRL", units, nanos: Number(cents.padEnd(2, "0")) * 10_000_000 };
}

async function prices(brl) {
  const r = await play("POST", `${P}/pricing:convertRegionPrices`, { price: money(brl) });
  if (r.regionVersion?.version) REGIONS = `regionsVersion.version=${r.regionVersion.version}`;
  const regions = Object.values(r.convertedRegionPrices).map((x) => ({ regionCode: x.regionCode, price: x.price }));
  const br = regions.find((x) => x.regionCode === "BR");
  if (br) br.price = money(brl); // o preço base fica exato (R$ x,90)
  return { regions, other: r.convertedOtherRegionsPrice };
}

const short = (id) => id.split(".").pop();
const listings = (p, extra = () => ({})) => {
  const [en, es] = NAMES[short(p.productId)] ?? [p.title, p.title];
  return [
    { languageCode: "pt-BR", title: p.title.slice(0, 55), description: describe(p, "pt"), ...extra("pt") },
    { languageCode: "en-US", title: en.slice(0, 55), description: describe(p, "en"), ...extra("en") },
    { languageCode: "es-ES", title: es.slice(0, 55), description: describe(p, "es"), ...extra("es") },
  ];
};

async function oneTime(p) {
  const { regions, other } = await prices(p.priceBRL);
  const body = {
    packageName: PKG,
    productId: p.productId,
    listings: listings(p),
    purchaseOptions: [
      {
        purchaseOptionId: OPTION,
        buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
        regionalPricingAndAvailabilityConfigs: regions.map((r) => ({ ...r, availability: "AVAILABLE" })),
        newRegionsConfig: { usdPrice: other.usdPrice, eurPrice: other.eurPrice, availability: "AVAILABLE" },
      },
    ],
  };
  if (DRY) return console.log(`[simulação] ${p.productId} R$ ${p.priceBRL} (${regions.length} países)`);
  await play(
    "PATCH",
    `${P}/onetimeproducts/${p.productId}?updateMask=listings,purchaseOptions&allowMissing=true&${REGIONS}`,
    body,
  );
  await play("POST", `${P}/oneTimeProducts/${p.productId}/purchaseOptions:batchUpdateStates`, {
    requests: [{ activatePurchaseOptionRequest: { packageName: PKG, productId: p.productId, purchaseOptionId: OPTION } }],
  });
  console.log(`+ ${short(p.productId)} ativo — R$ ${p.priceBRL} · ${describe(p, "pt")}`);
}

async function subscription(p) {
  const { regions, other } = await prices(p.priceBRL);
  const benefits = { pt: p.benefits ?? [], en: ["Auto-collect in every city", "+50% speed", "Daily gems"], es: ["Autorecogida en todas las ciudades", "+50% de velocidad", "Diamantes diarios"] };
  const body = {
    packageName: PKG,
    productId: p.productId,
    listings: listings(p, (lang) => ({
      benefits: benefits[lang].slice(0, 4).map((b) => b.slice(0, 40)),
      description: { pt: "Assinatura mensal com renovação automática.", en: "Monthly subscription, renews automatically.", es: "Suscripción mensual con renovación automática." }[lang],
    })),
    basePlans: [
      {
        basePlanId: "mensal",
        autoRenewingBasePlanType: { billingPeriodDuration: "P1M", gracePeriodDuration: "P3D", resubscribeState: "RESUBSCRIBE_STATE_ACTIVE" },
        regionalConfigs: regions.map((r) => ({ ...r, newSubscriberAvailability: true })),
        otherRegionsConfig: { usdPrice: other.usdPrice, eurPrice: other.eurPrice, newSubscriberAvailability: true },
      },
    ],
  };
  if (DRY) return console.log(`[simulação] assinatura ${p.productId} R$ ${p.priceBRL}/mês`);
  const existing = await play("GET", `${P}/subscriptions/${p.productId}`).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
  if (existing) {
    await play("PATCH", `${P}/subscriptions/${p.productId}?updateMask=listings&${REGIONS}`, body);
  } else {
    await play("POST", `${P}/subscriptions?productId=${p.productId}&${REGIONS}`, body);
  }
  await play("POST", `${P}/subscriptions/${p.productId}/basePlans/mensal:activate`, {}).catch((e) => {
    if (!/already|ACTIVE/i.test(e.message)) throw e;
  });
  console.log(`+ ${short(p.productId)} ativa — R$ ${p.priceBRL}/mês (plano base "mensal")`);
}

const items = catalog();
for (const p of items) {
  try {
    if (p.kind === "subscription") await subscription(p);
    else await oneTime(p);
  } catch (e) {
    console.error(`! ${short(p.productId)}: ${e.message.slice(0, 400)}`);
  }
}
