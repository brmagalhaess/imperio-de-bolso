import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminGet,
  adminPost,
  ApiError,
  type Economy,
  type EventRow,
  getToken,
  type Overview,
  type PlayerDetail,
  type PlayerRow,
  type Ranking,
  type Reports,
  setToken,
} from "./api";
import {
  exportPlayersCsv,
  PLATFORM_NAMES,
  PlatformsSection,
  PlayerSupport,
  RevenueView,
  TrendsSection,
} from "./insights";

// Painel administrativo (docs/README.md §3; ADR 0021/0030): visão geral com tendências, receita,
// economia, ranking, moderação, jogadores (com ações de suporte) e eventos.

const fmt = (v: string | number) => {
  try {
    return BigInt(v).toLocaleString("pt-BR");
  } catch {
    return String(v);
  }
};
/** Número grande abreviado como no jogo (1,2 mi · 3,4 bi · 5,6 tri …). */
const short = (v: string | number) => {
  let n: number;
  try {
    n = Number(BigInt(v));
  } catch {
    n = Number(v);
  }
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e18, "qi"],
    [1e15, "qa"],
    [1e12, "tri"],
    [1e9, "bi"],
    [1e6, "mi"],
    [1e3, "mil"],
  ];
  for (const [base, unit] of units) {
    if (abs >= base)
      return `${(n / base).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit}`;
  }
  return n.toLocaleString("pt-BR");
};
const pct = (v: number | null) =>
  v === null ? "—" : `${Math.round(v * 100)}%`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

const DISTRICT_NAMES: Record<string, string> = {
  praia: "Ilha da Praia",
  cidade: "Cidade",
  porto: "Porto da Marina",
  centro: "Centro Financeiro",
  industrial: "Polo Industrial",
  serra: "Serra Nevada",
  ilha: "Ilha Paraíso",
  espaco: "Centro Espacial",
};
const districtName = (d: string | null) => (d ? (DISTRICT_NAMES[d] ?? d) : "—");

/** Motivos do ledger em português, pelo prefixo antes de ":" (o código fica no title). */
const REASONS: Record<string, string> = {
  initial_grant: "Saldo inicial",
  production_collect: "Coleta manual",
  production_auto: "Produção automática (ajudantes)",
  business_purchase: "Compra de negócio",
  business_upgrade: "Melhoria",
  manager_hire: "Contratar ajudante",
  mission: "Prêmio de missão",
  mission_chest: "Baú das missões",
  achievement: "Prêmio de conquista",
  daily: "Prêmio diário",
  event: "Evento de fim de semana",
  podium: "Pódio da semana",
  prestige_reset: "Venda do império",
  vip_daily: "Diamantes do VIP",
  ad: "Anúncio recompensado",
  boost: "Coleta antecipada",
  store: "Loja (diamantes)",
  purchase: "Compra com dinheiro",
  refund: "Reembolso",
  admin_grant: "Diamantes do suporte",
};
const reasonName = (r: string) => {
  const [base, detail] = r.split(":");
  const name = REASONS[base ?? r] ?? r;
  return detail && name !== r ? `${name} · ${detail}` : name;
};

type Tab =
  | "overview"
  | "revenue"
  | "economy"
  | "ranking"
  | "moderation"
  | "players"
  | "events";
const TABS: [Tab, string, string][] = [
  ["overview", "📊", "Visão geral"],
  ["revenue", "💰", "Receita"],
  ["players", "👥", "Jogadores"],
  ["economy", "🪙", "Economia"],
  ["ranking", "🏆", "Ranking"],
  ["moderation", "🛡️", "Moderação"],
  ["events", "📜", "Eventos"],
];

export function App() {
  const [token, setTokenState] = useState(getToken());
  const [tab, setTab] = useState<Tab>("overview");
  const [player, setPlayer] = useState<string | null>(null);
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    setToken("");
    setTokenState("");
  }, []);
  const openPlayer = useCallback((id: string) => {
    setPlayer(id);
    setTab("players");
  }, []);

  if (!token) return <Login onLogin={(t) => setTokenState(t)} />;

  const props: ViewProps = {
    onError: setError,
    onAuthFail: logout,
    openPlayer,
  };
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <img src="/icone.png" alt="" width={40} height={40} />
          <div>
            <strong>Império de Bolso</strong>
            <small>Painel admin</small>
          </div>
        </div>
        <nav>
          {TABS.map(([t, icon, label]) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setPlayer(null);
              }}
            >
              <span aria-hidden>{icon}</span> {label}
            </button>
          ))}
        </nav>
        <button className="ghost logout" onClick={logout}>
          Sair
        </button>
      </aside>
      <main>
        <header>
          <h1>{TABS.find(([t]) => t === tab)?.[2]}</h1>
        </header>
        {error && <p className="error">{error}</p>}
        {tab === "overview" && <OverviewView {...props} />}
        {tab === "revenue" && <RevenueView {...props} />}
        {tab === "economy" && <EconomyView {...props} />}
        {tab === "ranking" && <RankingView {...props} />}
        {tab === "moderation" && <ModerationView {...props} />}
        {tab === "players" &&
          (player ? (
            <PlayerView id={player} onBack={() => setPlayer(null)} {...props} />
          ) : (
            <PlayersView {...props} />
          ))}
        {tab === "events" && <EventsView {...props} />}
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await adminGet<Overview>("/overview", value);
      setToken(value);
      onLogin(value);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Token inválido"
          : String(err),
      );
    }
  };
  return (
    <form className="login" onSubmit={submit}>
      <h1>Império de Bolso · Admin</h1>
      <p>Informe o ADMIN_TOKEN configurado na API.</p>
      <input
        type="password"
        autoComplete="off"
        placeholder="ADMIN_TOKEN"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" disabled={value.length < 32}>
        Entrar
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export interface ViewProps {
  onError: (msg: string) => void;
  onAuthFail: () => void;
  openPlayer: (id: string) => void;
}

export function useAdmin<T>(path: string, { onError, onAuthFail }: ViewProps) {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await adminGet<T>(path));
      onError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onAuthFail();
      else onError(String(err));
    }
  }, [path, onError, onAuthFail]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, reload: load };
}

function Cards({ items }: { items: [string, string, string?][] }) {
  return (
    <section className="cards">
      {items.map(([label, value, hint]) => (
        <div className="card" key={label}>
          <span>{label}</span>
          <strong className={value.length > 14 ? "long" : ""}>{value}</strong>
          {hint && <small className="muted">{hint}</small>}
        </div>
      ))}
    </section>
  );
}

/** Barra horizontal simples (0–100%). */
function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar">
      <div style={{ width: `${w}%` }} />
    </div>
  );
}

function OverviewView(props: ViewProps) {
  const { data, reload } = useAdmin<Overview>("/overview", props);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void reload(), 60_000);
    return () => clearInterval(t);
  }, [auto, reload]);
  if (!data) return <p className="muted">Carregando…</p>;
  const events = Object.entries(data.eventsLast24h).sort((a, b) => b[1] - a[1]);
  const funnelMax = Math.max(1, ...data.mapFunnel.map((m) => m.players));
  const linked = Object.entries(data.linkedAccounts)
    .map(([p, n]) => `${p} ${n}`)
    .join(" · ");
  return (
    <>
      <div className="toolbar">
        <span className="muted">Atualizado {when(data.serverTime)}</span>
        <span className="badge">
          {data.features.purchases ? "Compras ligadas" : "Sem compras (v1.0)"}
        </span>
        <span className="badge">
          {data.features.ads ? "Anúncios ligados" : "Sem anúncios (v1.0)"}
        </span>
        <label className="check">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          Atualizar a cada minuto
        </label>
        <button onClick={() => void reload()}>Atualizar</button>
      </div>
      <PlatformsSection {...props} />
      <TrendsSection {...props} />
      <h2>Jogadores</h2>
      <Cards
        items={[
          ["Jogadores", fmt(data.players)],
          ["Novos hoje", fmt(data.newToday)],
          ["Ativos hoje (DAU)", fmt(data.dau)],
          ["Ativos 7 dias", fmt(data.wau)],
          ["Tutorial concluído", pct(data.tutorialCompletionRate)],
          [
            "Retenção D1",
            pct(data.d1Retention),
            "criados ontem que voltaram hoje",
          ],
          [
            "Retenção D7",
            pct(data.d7Retention),
            "criados há 7 dias que voltaram hoje",
          ],
          ["Contas vinculadas", linked || "0", "Google / Apple"],
        ]}
      />
      <h2>Hoje no jogo</h2>
      <Cards
        items={[
          ["Prêmios diários resgatados", fmt(data.today.dailyRewards)],
          ["Missões resgatadas", fmt(data.today.missionsClaimed)],
          ["Baús das missões", fmt(data.today.chestsOpened)],
          ["Diamantes gastos", fmt(data.today.gemsSpent)],
          ["Auto-coleta ativa", fmt(data.boosts.autoCollect)],
          ["Turbo ativo", fmt(data.boosts.turbo)],
          ["VIP ativo", fmt(data.boosts.vip)],
          [
            "Evento de fim de semana",
            data.weekendEvent
              ? `${fmt(data.weekendEvent.participants)} jogando`
              : "Fora do fim de semana",
            data.weekendEvent
              ? `${fmt(data.weekendEvent.claimed)} completaram a meta`
              : undefined,
          ],
        ]}
      />
      <h2>Progresso</h2>
      <Cards
        items={[
          [
            "Venderam o império",
            fmt(data.prestige.players),
            `${fmt(data.prestige.sales)} vendas no total`,
          ],
          ["Estrelas de investidor", fmt(data.prestige.stars)],
          ["Moedas em circulação", short(data.coinsInCirculation)],
          ["Diamantes em circulação", fmt(data.gemsInCirculation)],
          ["Denúncias abertas", fmt(data.openReports), "aba Moderação"],
        ]}
      />
      <h2>Funil por mapa (jogadores com algum negócio)</h2>
      <table>
        <tbody>
          {data.mapFunnel.map((m) => (
            <tr key={m.district}>
              <td>{districtName(m.district)}</td>
              <td className="wide">
                <Bar value={m.players} max={funnelMax} />
              </td>
              <td className="num">{fmt(m.players)}</td>
              <td className="num muted">
                {pct(data.players ? m.players / data.players : 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Eventos nas últimas 24 h</h2>
      {events.length === 0 ? (
        <p className="muted">Nenhum evento.</p>
      ) : (
        <table>
          <tbody>
            {events.map(([name, count]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="num">{fmt(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const TIER_LABELS = ["1–9", "10–24", "25–49", "50–99", "100"];

function EconomyView(props: ViewProps) {
  const { data, reload } = useAdmin<Economy>("/economy", props);
  const [district, setDistrict] = useState("");
  const rows = useMemo(
    () =>
      (data?.businesses ?? []).filter(
        (b) => !district || b.district === district,
      ),
    [data, district],
  );
  if (!data) return <p className="muted">Carregando…</p>;
  const maxOwners = Math.max(1, ...data.businesses.map((b) => b.owners));
  return (
    <>
      <div className="toolbar">
        <select value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">
            Todos os mapas ({data.businesses.length} negócios)
          </option>
          {Object.entries(DISTRICT_NAMES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button onClick={() => void reload()}>Atualizar</button>
      </div>
      <h2>Negócios</h2>
      <table>
        <thead>
          <tr>
            <th>Negócio</th>
            <th>Mapa</th>
            <th className="num">Preço</th>
            <th className="num">Donos</th>
            <th></th>
            <th className="num">Ajudantes</th>
            <th className="num">Nível médio</th>
            <th className="num">Maior</th>
            {TIER_LABELS.map((t) => (
              <th
                key={t}
                className="num"
                title="jogadores com o negócio nesta faixa de visual"
              >
                Nv {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.slug}>
              <td>{b.name}</td>
              <td className="muted">{districtName(b.district)}</td>
              <td className="num">{short(b.cost)}</td>
              <td className="num">{fmt(b.owners)}</td>
              <td className="wide">
                <Bar value={b.owners} max={maxOwners} />
              </td>
              <td className="num">{fmt(b.helpers)}</td>
              <td className="num">
                {b.avgLevel === null ? "—" : b.avgLevel.toFixed(1)}
              </td>
              <td className="num">{b.maxLevel ?? "—"}</td>
              {b.tiers.map((t, i) => (
                <td key={i} className="num muted">
                  {t || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Entradas e saídas nos últimos 7 dias</h2>
      <table>
        <thead>
          <tr>
            <th>Motivo</th>
            <th>Moeda</th>
            <th className="num">Total</th>
            <th className="num">Lançamentos</th>
          </tr>
        </thead>
        <tbody>
          {data.flows7d.map((f) => (
            <tr key={`${f.currency}-${f.reason}`}>
              <td title={f.reason}>{reasonName(f.reason)}</td>
              <td>{f.currency === "GEMS" ? "Diamantes" : "Moedas"}</td>
              <td className={`num ${f.total.startsWith("-") ? "neg" : "pos"}`}>
                {f.currency === "GEMS" ? fmt(f.total) : short(f.total)}
              </td>
              <td className="num">{fmt(f.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function RankingView(props: ViewProps) {
  const { data, reload } = useAdmin<Ranking>("/ranking", props);
  if (!data) return <p className="muted">Carregando…</p>;
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          Semana {new Date(data.week.start).toLocaleDateString("pt-BR")} a{" "}
          {new Date(new Date(data.week.end).getTime() - 1).toLocaleDateString(
            "pt-BR",
          )}
        </span>
        <button onClick={() => void reload()}>Atualizar</button>
      </div>
      <h2>Ligas desta semana</h2>
      <Cards
        items={data.leagues.map((l) => [l.name, `${fmt(l.players)} jogadores`])}
      />
      <h2>Top 20 da semana (faturamento de produção)</h2>
      {data.top.length === 0 ? (
        <p className="muted">Ninguém faturou nesta semana ainda.</p>
      ) : (
        <table>
          <tbody>
            {data.top.map((t) => (
              <tr
                key={t.playerId}
                className="clickable"
                onClick={() => props.openPlayer(t.playerId)}
              >
                <td className="num">#{t.rank}</td>
                <td>{t.displayName}</td>
                <td className="num">{short(t.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Pódio da semana passada</h2>
      {data.podium.rewards.length === 0 ? (
        <p className="muted">
          Nenhum prêmio registrado (o prêmio é gerado quando o jogador abre o
          jogo).
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ranking</th>
              <th className="num">Lugar</th>
              <th>Jogador</th>
              <th className="num">Diamantes</th>
              <th>Resgatado</th>
            </tr>
          </thead>
          <tbody>
            {data.podium.rewards.map((r) => (
              <tr
                key={`${r.playerId}-${r.kind}`}
                className="clickable"
                onClick={() => props.openPlayer(r.playerId)}
              >
                <td>
                  {r.kind === "semana"
                    ? "Geral"
                    : `Liga ${data.leagues[r.league ?? 0]?.name ?? ""}`}
                </td>
                <td className="num">{r.rank}º</td>
                <td>{r.displayName}</td>
                <td className="num">{r.gems}</td>
                <td>{r.claimed ? "✓" : "aguardando"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function ModerationView(props: ViewProps) {
  const { data, reload } = useAdmin<Reports>("/reports", props);
  const [busy, setBusy] = useState("");
  const act = async (
    id: string,
    action: "reset-name" | "dismiss",
    name: string,
  ) => {
    const question =
      action === "reset-name"
        ? `Trocar o nome "${name}" pelo padrão (Empreendedor NNNN)?`
        : `Arquivar as denúncias de "${name}" sem trocar o nome?`;
    if (!window.confirm(question)) return;
    setBusy(id);
    try {
      await adminPost(`/reports/${id}/${action}`);
      await reload();
    } catch (err) {
      props.onError(String(err));
    } finally {
      setBusy("");
    }
  };
  if (!data) return <p className="muted">Carregando…</p>;
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          Nomes denunciados no ranking. Com 3 denunciantes o nome escolhido
          volta ao padrão sozinho. Já resolvidas: {fmt(data.resolved)}.
        </span>
        <button onClick={() => void reload()}>Atualizar</button>
      </div>
      {data.open.length === 0 ? (
        <p className="muted">Nenhuma denúncia aberta. 🎉</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th className="num">Denúncias</th>
              <th>Última</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.open.map((r) => (
              <tr key={r.playerId}>
                <td
                  className="clickable"
                  onClick={() => props.openPlayer(r.playerId)}
                >
                  {r.displayName}
                </td>
                <td className="muted">
                  {r.customName ? "escolhido pelo jogador" : "nome padrão"}
                </td>
                <td className="num">{r.reports}</td>
                <td>{when(r.lastReportAt)}</td>
                <td className="actions">
                  <button
                    className="danger"
                    disabled={busy === r.playerId}
                    onClick={() =>
                      void act(r.playerId, "reset-name", r.displayName)
                    }
                  >
                    Trocar nome
                  </button>
                  <button
                    className="secondary"
                    disabled={busy === r.playerId}
                    onClick={() =>
                      void act(r.playerId, "dismiss", r.displayName)
                    }
                  >
                    Arquivar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function PlayersView(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState("all");
  const { data: raw } = useAdmin<{ players: PlayerRow[] }>(
    `/players?limit=200&sort=${sort}${query ? `&search=${encodeURIComponent(query)}` : ""}`,
    props,
  );
  const FILTERS: Record<string, (p: PlayerRow) => boolean> = {
    all: () => true,
    active: (p) =>
      !!p.lastSeenAt &&
      Date.now() - new Date(p.lastSeenAt).getTime() < 86_400_000,
    linked: (p) => p.linked,
    prestige: (p) => p.prestigeStars > 0,
    staff: (p) => p.staff,
    ios: (p) => p.platform === "ios",
    android: (p) => p.platform === "android",
    new: (p) => Date.now() - new Date(p.createdAt).getTime() < 86_400_000,
  };
  const data = raw && {
    players: raw.players.filter(FILTERS[filter] ?? (() => true)),
  };
  return (
    <>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <input
          placeholder="Nome ou código do jogador (8 letras do Perfil)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Mais novos</option>
          <option value="seen">Jogaram por último</option>
          <option value="stars">Mais estrelas</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="active">Ativos nas últimas 24 h</option>
          <option value="new">Novos (24 h)</option>
          <option value="linked">Conta vinculada</option>
          <option value="prestige">Já venderam o império</option>
          <option value="staff">Equipe</option>
          <option value="ios">iPhone</option>
          <option value="android">Android</option>
        </select>
        <button type="submit">Buscar</button>
        {data && data.players.length > 0 && (
          <button
            type="button"
            className="ghost"
            onClick={() => exportPlayersCsv(data.players)}
          >
            ⬇ Exportar CSV ({data.players.length})
          </button>
        )}
      </form>
      {!data ? (
        <p className="muted">Carregando…</p>
      ) : data.players.length === 0 ? (
        <p className="muted">Nenhum jogador encontrado.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Código</th>
              <th>Criado</th>
              <th>Último sinal</th>
              <th>Aparelho</th>
              <th>Mapa</th>
              <th className="num">Moedas</th>
              <th className="num">Diamantes</th>
              <th className="num">Negócios</th>
              <th className="num">⭐</th>
              <th>Tutorial</th>
              <th>Vinculada</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr
                key={p.id}
                className="clickable"
                onClick={() => props.openPlayer(p.id)}
              >
                <td>
                  {p.displayName}
                  {p.staff ? <span className="muted"> · equipe</span> : null}
                </td>
                <td className="mono">{p.id.slice(0, 8).toUpperCase()}</td>
                <td>{when(p.createdAt)}</td>
                <td>{when(p.lastSeenAt)}</td>
                <td>
                  {p.platform === "ios"
                    ? "🍎 iPhone"
                    : p.platform === "android"
                      ? "🤖 Android"
                      : "—"}
                  {p.appVersion ? (
                    <span className="muted"> {p.appVersion}</span>
                  ) : null}
                </td>
                <td>{districtName(p.currentDistrict)}</td>
                <td className="num">{short(p.coins)}</td>
                <td className="num">{fmt(p.gems)}</td>
                <td className="num">{p.businesses}</td>
                <td className="num">{p.prestigeStars || ""}</td>
                <td>{p.tutorialCompleted ? "✓" : "—"}</td>
                <td>{p.linked ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function PlayerView({
  id,
  onBack,
  ...props
}: ViewProps & { id: string; onBack: () => void }) {
  const { data, reload } = useAdmin<PlayerDetail>(`/players/${id}`, props);
  const [busy, setBusy] = useState(false);
  const resetName = async () => {
    if (
      !data ||
      !window.confirm(
        `Trocar o nome "${data.displayName}" pelo padrão (Empreendedor NNNN)?`,
      )
    )
      return;
    setBusy(true);
    try {
      await adminPost(`/reports/${id}/reset-name`);
      await reload();
    } catch (err) {
      props.onError(String(err));
    } finally {
      setBusy(false);
    }
  };
  const toggleStaff = async () => {
    if (!data) return;
    const question = data.staff
      ? `Colocar "${data.displayName}" de volta no ranking?`
      : `Marcar "${data.displayName}" como conta da equipe? Ela sai de todos os rankings e pódios.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      await adminPost(`/players/${id}/${data.staff ? "unstaff" : "staff"}`);
      await reload();
    } catch (err) {
      props.onError(String(err));
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <>
        <div className="toolbar">
          <button onClick={onBack}>← Jogadores</button>
        </div>
        <p className="muted">Carregando…</p>
      </>
    );
  const byDistrict = Object.keys(DISTRICT_NAMES)
    .map((d) => [d, data.businesses.filter((b) => b.district === d)] as const)
    .filter(([, list]) => list.length > 0);
  return (
    <>
      <div className="toolbar">
        <button onClick={onBack}>← Jogadores</button>
        <button
          disabled={busy}
          className="ghost"
          onClick={() => void resetName()}
        >
          Trocar nome pelo padrão
        </button>
        <button disabled={busy} onClick={() => void toggleStaff()}>
          {data.staff
            ? "Voltar ao ranking"
            : "Conta da equipe (tirar do ranking)"}
        </button>
      </div>
      <h2>
        {data.displayName}
        {data.staff ? (
          <span className="chip">equipe · fora do ranking</span>
        ) : null}{" "}
        <span className="mono muted">#{data.code}</span>
      </h2>
      <p className="muted">
        Criado {when(data.createdAt)} · último sinal {when(data.lastSeenAt)} ·
        mapa {districtName(data.currentDistrict)} · tutorial{" "}
        {data.tutorialCompleted ? "concluído" : "pendente"}
        {data.nameChanged ? " · nome escolhido" : ""}
        {data.platform
          ? ` · ${(PLATFORM_NAMES[data.platform] ?? data.platform).replace(/^\S+ /, "")}${data.appVersion ? ` ${data.appVersion}` : ""}`
          : ""}
        {data.identities.length
          ? ` · vinculada: ${data.identities.join(", ")}`
          : ""}
      </p>
      <Cards
        items={[
          ["Moedas", short(data.coins), fmt(data.coins)],
          ["Diamantes", fmt(data.gems)],
          [
            "Estrelas",
            fmt(data.prestige.stars),
            `${data.prestige.count} venda(s) do império`,
          ],
          ["Liga", data.league ?? "—"],
          ["Sequência diária", `${data.loginStreak} dia(s)`],
          ["Conquistas", fmt(data.achievements)],
          [
            "Reforços",
            [
              data.boosts.vipUntil && "VIP",
              data.boosts.autoCollectUntil && "Auto-coleta",
              data.boosts.turboUntil && "Turbo",
            ]
              .filter(Boolean)
              .join(" · ") || "nenhum",
          ],
          ["Denúncias abertas", fmt(data.openReports)],
        ]}
      />
      <PlayerSupport
        id={id}
        name={data.displayName}
        onChanged={() => void reload()}
        {...props}
      />
      <h2>Missões de hoje</h2>
      {data.missionsToday.length === 0 ? (
        <p className="muted">Ainda não abriu as missões hoje.</p>
      ) : (
        <div className="chips">
          {data.missionsToday.map((m) => (
            <span key={m.template} className="chip">
              {m.template} · {short(m.progress)}/{short(m.target)}{" "}
              {m.claimed ? "✓" : ""}
            </span>
          ))}
        </div>
      )}
      <h2>Negócios ({data.businesses.length})</h2>
      {byDistrict.map(([d, list]) => (
        <div key={d} className="district">
          <strong>{districtName(d)}</strong>
          <div className="chips">
            {list.map((b) => (
              <span key={b.slug} className="chip">
                {b.name} · nv {b.level}
                {b.helper ? " · 👷" : ""}
              </span>
            ))}
          </div>
        </div>
      ))}
      <h2>Últimas 100 movimentações (ledger)</h2>
      <table>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Motivo</th>
            <th>Moeda</th>
            <th className="num">Valor</th>
            <th className="num">Saldo depois</th>
          </tr>
        </thead>
        <tbody>
          {data.ledger.map((l, i) => (
            <tr key={i}>
              <td>{when(l.at)}</td>
              <td title={l.reason}>{reasonName(l.reason)}</td>
              <td>{l.currency === "GEMS" ? "Diamantes" : "Moedas"}</td>
              <td className={`num ${l.delta.startsWith("-") ? "neg" : "pos"}`}>
                {fmt(l.delta)}
              </td>
              <td className="num">{fmt(l.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function EventsView(props: ViewProps) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const { data } = useAdmin<{ events: EventRow[] }>(
    `/events?limit=200${query ? `&name=${encodeURIComponent(query)}` : ""}`,
    props,
  );
  return (
    <>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(name);
        }}
      >
        <input
          placeholder="Filtrar por evento (ex.: mission_claimed, prestige, player_reported)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Filtrar</button>
      </form>
      {!data ? (
        <p className="muted">Carregando…</p>
      ) : data.events.length === 0 ? (
        <p className="muted">Nenhum evento.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Evento</th>
              <th>Jogador</th>
              <th>Propriedades</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id}>
                <td>{when(e.at)}</td>
                <td>{e.name}</td>
                <td
                  className={`mono ${e.playerId ? "clickable" : ""}`}
                  onClick={() => e.playerId && props.openPlayer(e.playerId)}
                >
                  {e.playerId?.slice(0, 8).toUpperCase() ?? "—"}
                </td>
                <td className="mono">{JSON.stringify(e.props)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
