import { useCallback, useEffect, useState } from "react";
import {
  adminGet,
  ApiError,
  type EventRow,
  getToken,
  type Overview,
  type PlayerDetail,
  type PlayerRow,
  setToken,
} from "./api";

// Painel administrativo mínimo (docs/README.md §3, Etapa 3) — SOMENTE LEITURA.

const fmt = (v: string | number) => {
  try {
    return BigInt(v).toLocaleString("pt-BR");
  } catch {
    return String(v);
  }
};
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");

type Tab = "overview" | "players" | "events";

export function App() {
  const [token, setTokenState] = useState(getToken());
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    setToken("");
    setTokenState("");
  }, []);

  if (!token) return <Login onLogin={(t) => setTokenState(t)} />;

  return (
    <div className="shell">
      <header>
        <h1>Império de Bolso · Admin</h1>
        <nav>
          {(["overview", "players", "events"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {{ overview: "Visão geral", players: "Jogadores", events: "Eventos" }[t]}
            </button>
          ))}
          <button className="ghost" onClick={logout}>
            Sair
          </button>
        </nav>
      </header>
      {error && <p className="error">{error}</p>}
      <main>
        {tab === "overview" && <OverviewView onError={setError} onAuthFail={logout} />}
        {tab === "players" && <PlayersView onError={setError} onAuthFail={logout} />}
        {tab === "events" && <EventsView onError={setError} onAuthFail={logout} />}
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
      setError(err instanceof ApiError && err.status === 401 ? "Token inválido" : String(err));
    }
  };
  return (
    <form className="login" onSubmit={submit}>
      <h1>Império de Bolso · Admin</h1>
      <p>Painel somente leitura. Informe o ADMIN_TOKEN configurado na API.</p>
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

interface ViewProps {
  onError: (msg: string) => void;
  onAuthFail: () => void;
}

function useAdmin<T>(path: string, { onError, onAuthFail }: ViewProps) {
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

function OverviewView(props: ViewProps) {
  const { data, reload } = useAdmin<Overview>("/overview", props);
  if (!data) return <p className="muted">Carregando…</p>;
  const cards: [string, string][] = [
    ["Jogadores", fmt(data.players)],
    ["Novos hoje", fmt(data.newToday)],
    ["Ativos hoje (DAU)", fmt(data.dau)],
    ["Ativos 7 dias", fmt(data.wau)],
    ["Tutorial concluído", pct(data.tutorialCompletionRate)],
    ["Retenção D1", pct(data.d1Retention)],
    ["Moedas em circulação", fmt(data.coinsInCirculation)],
    ["Diamantes em circulação", fmt(data.gemsInCirculation)],
  ];
  const events = Object.entries(data.eventsLast24h).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="toolbar">
        <span className="muted">Atualizado {when(data.serverTime)}</span>
        <button onClick={() => void reload()}>Atualizar</button>
      </div>
      <section className="cards">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
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

function PlayersView(props: ViewProps) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data } = useAdmin<{ players: PlayerRow[] }>(
    `/players?limit=100${query ? `&search=${encodeURIComponent(query)}` : ""}`,
    props,
  );
  if (selected) return <PlayerView id={selected} onBack={() => setSelected(null)} {...props} />;
  return (
    <>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <input placeholder="Buscar pelo nome" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit">Buscar</button>
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
              <th>Criado</th>
              <th>Último sinal</th>
              <th>Mapa</th>
              <th className="num">Moedas</th>
              <th className="num">Diamantes</th>
              <th className="num">Negócios</th>
              <th>Tutorial</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => setSelected(p.id)}>
                <td>{p.displayName}</td>
                <td>{when(p.createdAt)}</td>
                <td>{when(p.lastSeenAt)}</td>
                <td>{p.currentDistrict ?? "—"}</td>
                <td className="num">{fmt(p.coins)}</td>
                <td className="num">{fmt(p.gems)}</td>
                <td className="num">{p.businesses}</td>
                <td>{p.tutorialCompleted ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function PlayerView({ id, onBack, ...props }: ViewProps & { id: string; onBack: () => void }) {
  const { data } = useAdmin<PlayerDetail>(`/players/${id}`, props);
  return (
    <>
      <div className="toolbar">
        <button onClick={onBack}>← Jogadores</button>
      </div>
      {!data ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <h2>{data.displayName}</h2>
          <p className="muted">
            {fmt(data.coins)} moedas · {fmt(data.gems)} diamantes · {data.businesses.length} negócios
          </p>
          <div className="chips">
            {data.businesses.map((b) => (
              <span key={b.slug} className="chip">
                {b.slug} · nv {b.level}
                {b.helper ? " · ajudante" : ""}
              </span>
            ))}
          </div>
          <h2>Últimas 50 movimentações (ledger)</h2>
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
                  <td>{l.reason}</td>
                  <td>{l.currency === "GEMS" ? "Diamantes" : "Moedas"}</td>
                  <td className={`num ${l.delta.startsWith("-") ? "neg" : "pos"}`}>{fmt(l.delta)}</td>
                  <td className="num">{fmt(l.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
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
        <input placeholder="Filtrar por evento (ex.: mission_claimed)" value={name} onChange={(e) => setName(e.target.value)} />
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
                <td className="mono">{e.playerId?.slice(0, 8) ?? "—"}</td>
                <td className="mono">{JSON.stringify(e.props)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
