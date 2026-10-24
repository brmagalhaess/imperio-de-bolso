import { useState } from "react";
import {
  adminPost,
  type PlatformRow,
  type PlayerRow,
  type PurchaseRow,
  type Revenue,
  type TrendDay,
  type Trends,
} from "./api";
import { useAdmin, type ViewProps } from "./App";

// Painel admin v3 (ADR 0030): gráficos de tendência, receita das lojas e ações de suporte.

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => v.toLocaleString("pt-BR");
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR");
const STORE_NAMES: Record<string, string> = {
  apple: "App Store",
  google: "Google Play",
  mock: "Teste",
};

/** Gráfico de barras em SVG (sem biblioteca): um valor por dia, com o total e o pico. */
export function MiniChart({
  title,
  days,
  pick,
  format = num,
  color = "var(--teal)",
}: {
  title: string;
  days: TrendDay[];
  pick: (d: TrendDay) => number;
  format?: (v: number) => string;
  color?: string;
}) {
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const last = values[values.length - 1] ?? 0;
  const w = 100 / Math.max(1, values.length);
  return (
    <figure className="chart">
      <figcaption>
        <span>{title}</span>
        <strong>{format(last)}</strong>
        <small className="muted">
          hoje · {format(total)} em {values.length} dias
        </small>
      </figcaption>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={title}
      >
        {values.map((v, i) => {
          const h = (v / max) * 38;
          return (
            <rect
              key={i}
              x={i * w + w * 0.12}
              y={40 - h}
              width={w * 0.76}
              height={Math.max(h, v > 0 ? 0.8 : 0)}
              rx={0.6}
              fill={color}
              opacity={i === values.length - 1 ? 1 : 0.55}
            >
              <title>
                {days[i]!.day.split("-").reverse().join("/")}: {format(v)}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="chart-axis muted">
        <span>{days[0]?.day.slice(5).split("-").reverse().join("/")}</span>
        <span>
          {days[days.length - 1]?.day.slice(5).split("-").reverse().join("/")}
        </span>
      </div>
    </figure>
  );
}

export const PLATFORM_NAMES: Record<string, string> = {
  ios: "🍎 iPhone (App Store)",
  android: "🤖 Android (Google Play)",
  desconhecida: "❔ Ainda não identificados",
};

interface StoreInfo {
  version: string | null;
  releasedAt?: string | null;
  code?: string | null;
  status?: string | null;
  rollout?: number | null;
  testing?: { version: string | null; code?: string | null } | null;
  url?: string | null;
  error?: string;
  inUse: { version: string; players: number }[];
}

const RELEASE_STATUS: Record<string, string> = {
  completed: "publicada para todos",
  inProgress: "lançamento gradual",
  halted: "lançamento pausado",
};

/** Versão publicada em cada loja (App Store pela consulta pública; Google pela conta de serviço). */
export function StoresSection(props: ViewProps) {
  // "Atualizar" pede uma consulta nova às lojas (senão o servidor guarda por 10 min).
  const [fresh, setFresh] = useState(0);
  const { data } = useAdmin<{
    apple: StoreInfo;
    google: StoreInfo;
    checkedAt: string;
  }>(fresh ? `/stores?fresh=1&n=${fresh}` : "/stores", props);
  if (!data) return null;
  const card = (title: string, s: StoreInfo, tone: string) => (
    <div className={`kpi ${tone}`}>
      <span>{title}</span>
      <strong>{s.version ? `Versão ${s.version}` : "—"}</strong>
      {s.error && <small className="muted">{s.error}</small>}
      {s.releasedAt && (
        <small className="muted">
          no ar desde {new Date(s.releasedAt).toLocaleDateString("pt-BR")}
        </small>
      )}
      {s.status && (
        <small className="muted">
          {RELEASE_STATUS[s.status] ?? s.status}
          {s.rollout && s.rollout < 1
            ? ` (${Math.round(s.rollout * 100)}%)`
            : ""}
          {s.code ? ` · código ${s.code}` : ""}
        </small>
      )}
      {s.testing?.version && s.testing.version !== s.version && (
        <small className="muted">em teste interno: {s.testing.version}</small>
      )}
      <small className="muted">
        jogadores (7 dias):{" "}
        {s.inUse.length
          ? s.inUse.map((v) => `${v.version} (${num(v.players)})`).join(" · ")
          : "—"}
      </small>
      {s.url && (
        <small>
          <a href={s.url} target="_blank" rel="noreferrer">
            abrir na loja ↗
          </a>
        </small>
      )}
    </div>
  );
  return (
    <section>
      <div className="section-head">
        <h2>Versão nas lojas</h2>
        <span className="muted">
          conferido {new Date(data.checkedAt).toLocaleTimeString("pt-BR")}{" "}
          <button
            className="small ghost"
            onClick={() => setFresh((n) => n + 1)}
          >
            Atualizar
          </button>
        </span>
      </div>
      <div className="kpis">
        {card("🍎 App Store", data.apple, "")}
        {card("🤖 Google Play", data.google, "green")}
      </div>
    </section>
  );
}

/** De onde vêm os jogadores: aparelho da última abertura do jogo (sem a conta da equipe). */
export function PlatformsSection(props: ViewProps) {
  const { data } = useAdmin<{ platforms: PlatformRow[] }>("/platforms", props);
  if (!data) return null;
  const total = Math.max(
    1,
    data.platforms.reduce((s, p) => s + p.players, 0),
  );
  return (
    <section>
      <h2>De onde vêm os jogadores</h2>
      <div className="kpis">
        {data.platforms.map((p) => (
          <div
            key={p.platform}
            className={`kpi ${p.platform === "ios" ? "" : p.platform === "android" ? "green" : "orange"}`}
          >
            <span>{PLATFORM_NAMES[p.platform] ?? p.platform}</span>
            <strong>
              {num(p.players)}{" "}
              <small className="muted">
                ({Math.round((p.players / total) * 100)}%)
              </small>
            </strong>
            <small className="muted">
              novos: {num(p.newToday)} hoje · {num(p.new7d)} em 7 dias
            </small>
            <small className="muted">
              ativos: {num(p.activeToday)} hoje · {num(p.active7d)} em 7 dias
            </small>
            {p.versions.length > 0 && (
              <small className="muted">
                versões:{" "}
                {p.versions
                  .map((v) => `${v.version} (${num(v.players)})`)
                  .join(" · ")}
              </small>
            )}
          </div>
        ))}
      </div>
      <p className="muted">
        Quem abriu o jogo antes da 1.0.5 é identificado na próxima vez que abrir
        o app. Os contados como iPhone/Android já entraram pelo vínculo de conta
        ou por compra.
      </p>
    </section>
  );
}

/** Tendências dos últimos 30 dias (visão geral). */
export function TrendsSection(props: ViewProps) {
  const [days, setDays] = useState(30);
  const { data } = useAdmin<Trends>(`/trends?days=${days}`, props);
  return (
    <section>
      <div className="section-head">
        <h2>Tendências</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </div>
      {!data ? (
        <p className="muted">Carregando…</p>
      ) : (
        <div className="charts">
          <MiniChart
            title="Novos jogadores"
            days={data.days}
            pick={(d) => d.newPlayers}
          />
          <MiniChart
            title="Jogadores ativos"
            days={data.days}
            pick={(d) => d.activePlayers}
            color="var(--orange)"
          />
          <MiniChart
            title="Receita bruta estimada"
            days={data.days}
            pick={(d) => d.revenueBRL}
            format={brl}
            color="var(--green)"
          />
          <MiniChart
            title="Compras"
            days={data.days}
            pick={(d) => d.purchases}
            color="var(--green)"
          />
          <MiniChart
            title="Anúncios assistidos"
            days={data.days}
            pick={(d) => d.adViews}
            color="var(--purple)"
          />
          <MiniChart
            title="Vendas do império"
            days={data.days}
            pick={(d) => d.prestiges}
            color="var(--gold)"
          />
        </div>
      )}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

function PurchaseTable({
  rows,
  showPlayer,
  onRevoke,
  openPlayer,
}: {
  rows: PurchaseRow[];
  showPlayer?: boolean;
  onRevoke: (r: PurchaseRow) => void;
  openPlayer?: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="muted">Nenhuma compra ainda.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Quando</th>
          {showPlayer && <th>Jogador</th>}
          <th>Produto</th>
          <th>Loja</th>
          <th className="num">Preço</th>
          <th>Situação</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.store}:${r.transactionId}`}>
            <td>{when(r.at)}</td>
            {showPlayer && (
              <td>
                {r.playerId && openPlayer ? (
                  <a
                    href="#"
                    onClick={(e) => (
                      e.preventDefault(),
                      openPlayer(r.playerId!)
                    )}
                  >
                    {r.displayName}
                  </a>
                ) : (
                  r.displayName
                )}
              </td>
            )}
            <td title={r.productId}>{r.title}</td>
            <td>{STORE_NAMES[r.store] ?? r.store}</td>
            <td className="num">{brl(r.priceBRL)}</td>
            <td>
              {r.test ? (
                <span
                  className="badge"
                  title="Sandbox da Apple, testador do Google ou conta da equipe: não entra na receita"
                >
                  Teste
                </span>
              ) : (
                <span
                  className={`badge ${r.status === "VERIFIED" ? "ok" : "bad"}`}
                >
                  {r.status === "VERIFIED" ? "Paga" : "Reembolsada"}
                </span>
              )}
            </td>
            <td>
              {r.status === "VERIFIED" && !r.test && (
                <button className="small ghost" onClick={() => onRevoke(r)}>
                  Registrar reembolso
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function revoke(
  r: PurchaseRow,
  props: ViewProps,
  after: () => Promise<void>,
) {
  if (
    !window.confirm(
      `Registrar reembolso de "${r.title}" (${STORE_NAMES[r.store]})? O item é retirado do jogador (diamantes já gastos não ficam negativos).`,
    )
  )
    return;
  try {
    await adminPost("/purchases/revoke", {
      store: r.store,
      transactionId: r.transactionId,
    });
    await after();
  } catch (err) {
    props.onError(String(err));
  }
}

/** Aba Receita: totais, por loja, por produto e compras recentes (com reembolso manual). */
export function RevenueView(props: ViewProps) {
  const { data, reload } = useAdmin<Revenue>("/revenue", props);
  if (!data) return <p className="muted">Carregando…</p>;
  const t = data.totals;
  const subs = Object.entries(t.activeSubscriptions)
    .map(([s, n]) => `${STORE_NAMES[s] ?? s} ${n}`)
    .join(" · ");
  const maxProduct = Math.max(1, ...data.byProduct.map((p) => p.revenueBRL));
  return (
    <>
      <p className="muted">
        Só compras reais: as de teste (Sandbox da Apple, testadores do Google e
        contas da equipe) ficam no registro, marcadas como "Teste", e não entram
        nos números. Valores brutos pelo preço de tabela (R$); a loja fica com a
        comissão (15% a 30%).
      </p>
      <div className="kpis">
        <Kpi
          label="Receita (30 dias)"
          value={brl(t.revenue30dBRL)}
          hint={`${num(t.purchases30d)} compras`}
          tone="green"
        />
        <Kpi
          label="Receita total"
          value={brl(t.revenueBRL)}
          hint={`${num(t.purchases)} compras`}
        />
        <Kpi label="Compradores" value={num(t.buyers)} />
        <Kpi
          label="Ticket médio"
          value={brl(t.purchases ? t.revenueBRL / t.purchases : 0)}
        />
        <Kpi label="Assinantes VIP ativos" value={subs || "0"} tone="orange" />
        <Kpi
          label="Reembolsos"
          value={num(t.refunds)}
          tone={t.refunds ? "red" : ""}
        />
        <Kpi
          label="Compras de teste"
          value={num(t.testPurchases)}
          hint="Sandbox, testadores e equipe — não contam"
        />
      </div>
      <h2>Por loja</h2>
      <div className="kpis">
        {data.byStore.map((s) => (
          <Kpi
            key={s.store}
            label={STORE_NAMES[s.store] ?? s.store}
            value={brl(s.revenueBRL)}
            hint={`${num(s.purchases)} compras`}
          />
        ))}
      </div>
      <h2>Por produto</h2>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th className="num">Preço</th>
            <th className="num">Vendas</th>
            <th className="wide">Receita</th>
            <th className="num" />
            <th className="num">Reemb.</th>
          </tr>
        </thead>
        <tbody>
          {data.byProduct.map((p) => (
            <tr key={p.productId}>
              <td title={p.productId}>{p.title}</td>
              <td className="num">{brl(p.priceBRL)}</td>
              <td className="num">{num(p.count)}</td>
              <td className="wide">
                <div className="bar">
                  <div
                    style={{
                      width: `${Math.max(2, (p.revenueBRL / maxProduct) * 100)}%`,
                    }}
                  />
                </div>
              </td>
              <td className="num">{brl(p.revenueBRL)}</td>
              <td className="num">{p.refunds || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Compras recentes</h2>
      <PurchaseTable
        rows={data.recent}
        showPlayer
        openPlayer={props.openPlayer}
        onRevoke={(r) => void revoke(r, props, reload)}
      />
    </>
  );
}

/** Ficha do jogador: dar diamantes de compensação e compras com reembolso manual. */
export function PlayerSupport({
  id,
  name,
  onChanged,
  ...props
}: ViewProps & { id: string; name: string; onChanged: () => void }) {
  const { data, reload } = useAdmin<{ purchases: PurchaseRow[] }>(
    `/players/${id}/purchases`,
    props,
  );
  const [busy, setBusy] = useState(false);
  const giveGems = async () => {
    const amount = Number(
      window.prompt(`Quantos diamantes dar para "${name}"? (1 a 10.000)`, "50"),
    );
    if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) return;
    const note = window.prompt(
      "Motivo (fica registrado):",
      "Compensação de suporte",
    );
    if (!note || note.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await adminPost<{ gems: string }>(
        `/players/${id}/gems`,
        { amount, note },
        { "idempotency-key": crypto.randomUUID() },
      );
      window.alert(
        `Pronto: ${name} agora tem ${Number(r.gems).toLocaleString("pt-BR")} diamantes.`,
      );
      onChanged();
    } catch (err) {
      props.onError(String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="toolbar">
        <button disabled={busy} onClick={() => void giveGems()}>
          💎 Dar diamantes
        </button>
      </div>
      <h2>Compras ({data?.purchases.length ?? "…"})</h2>
      {data && (
        <PurchaseTable
          rows={data.purchases}
          onRevoke={(r) => void revoke(r, props, reload)}
        />
      )}
    </>
  );
}

/** Exporta a lista de jogadores visível para planilha (CSV, separador ";", abre no Excel). */
export function exportPlayersCsv(rows: PlayerRow[]) {
  const head = [
    "nome",
    "codigo",
    "criado",
    "ultimo_sinal",
    "mapa",
    "moedas",
    "diamantes",
    "negocios",
    "estrelas",
    "tutorial",
    "vinculada",
    "equipe",
    "aparelho",
    "versao",
  ];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((p) =>
    [
      p.displayName,
      p.id.slice(0, 8).toUpperCase(),
      p.createdAt,
      p.lastSeenAt ?? "",
      p.currentDistrict ?? "",
      p.coins,
      p.gems,
      p.businesses,
      p.prestigeStars,
      p.tutorialCompleted ? "sim" : "não",
      p.linked ? "sim" : "não",
      p.staff ? "sim" : "não",
      p.platform ?? "",
      p.appVersion ?? "",
    ]
      .map(cell)
      .join(";"),
  );
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `jogadores-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
