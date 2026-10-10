"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Clock3,
  CircleDollarSign,
  MessagesSquare,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "./ui/button";
export type SessionRow = {
  id: string;
  startedAt: string;
  status: string;
  duration: number;
  model: string;
  language: string;
  estimatedCost: string | null;
  costStatus: string;
  demo: boolean;
};
type Overview = {
  stats: {
    total?: number;
    active?: number;
    completed?: number;
    failed?: number;
    duration?: number;
    spend?: string;
    incomplete?: number;
    tokens?: number;
  };
  chart: { date: string; sessions: number; spend: number }[];
  recent: SessionRow[];
  refreshedAt: string;
  timezone: string;
};
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, { cache: "no-store", ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unable to load data.");
  return data;
}
export function duration(n: number) {
  return `${Math.floor(n / 60)}m ${n % 60}s`;
}
export function Status({ status }: { status: string }) {
  return (
    <span className={`session-status ${status.toLowerCase()}`}>
      <i />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
export function SessionTable({
  rows,
  timezone = "Asia/Kolkata",
}: {
  rows: SessionRow[];
  timezone?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Conversation</th>
            <th>Date & time</th>
            <th>Language</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Estimated API Cost</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link className="session-id" href={`/admin/sessions/${s.id}`}>
                    <span className="table-icon">
                      <MessagesSquare size={16} />
                    </span>
                    {s.id.startsWith("demo") ? s.id : `…${s.id.slice(-8)}`}
                  </Link>
                </td>
                <td>
                  {new Date(s.startedAt).toLocaleDateString("en-GB", {
                    month: "short",
                    day: "numeric",
                    timeZone: timezone,
                  })}
                  <small>
                    {new Date(s.startedAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: timezone,
                    })}
                  </small>
                </td>
                <td>{s.language}</td>
                <td>{duration(s.duration)}</td>
                <td>
                  <Status status={s.status} />
                </td>
                <td>
                  {s.estimatedCost === null ? (
                    <span className="muted-text">
                      {s.costStatus === "PRICING_UNAVAILABLE"
                        ? "Pricing unavailable"
                        : "Incomplete"}
                    </span>
                  ) : (
                    `$${Number(s.estimatedCost).toFixed(4)}`
                  )}
                  {s.demo && <small>Sample estimate</small>}
                </td>
                <td>
                  <Link
                    href={`/admin/sessions/${s.id}`}
                    aria-label={`View session ${s.id}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="empty-table">
                No conversations match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function AdminDashboard({
  sessionsOnly = false,
}: {
  sessionsOnly?: boolean;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState("7");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [interval, setIntervalValue] = useState("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refreshed, setRefreshed] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const query = new URLSearchParams({
    days,
    status,
    q,
    page: String(page),
    interval,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      if (sessionsOnly) {
        const result = await api<{ rows: SessionRow[]; total: number }>(
          `sessions?${query}`,
        );
        setRows(result.rows);
        setTotal(result.total);
      } else setData(await api<Overview>(`overview?${query}`));
      setError("");
      setRefreshed(new Date().toISOString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, sessionsOnly]);
  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    api<{ timezone: string }>("settings")
      .then((s) => setTimezone(s.timezone))
      .catch(() => {});
  }, []);
  const stats = data?.stats;
  const fmt = (n: number | undefined) => (n ?? 0).toLocaleString();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ASSISTANT, AT A GLANCE</span>
          <h1>{sessionsOnly ? "Conversations" : "A clearer picture."}</h1>
          <p>
            {sessionsOnly
              ? "Every conversation, thoughtfully organized."
              : "A little insight into every meaningful conversation."}
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/admin/export?${query}`}>
              <ArrowDownToLine size={15} />
              Export CSV
            </a>
          </Button>
        </div>
      </div>
      <div className="dashboard-toolbar">
        <div className="tabs">
          {["7", "30", "90"].map((d) => (
            <button
              key={d}
              className={days === d && !from ? "active" : ""}
              onClick={() => {
                setDays(d);
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Last {d} days
            </button>
          ))}
        </div>
        <div className="date-filters">
          <label>
            From{" "}
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            To{" "}
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={18} />
          {error}
          <Button variant="ghost" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      )}
      {loading ? (
        <div className="loading-state">
          <RefreshCw className="spin" />
          Loading workspace…
        </div>
      ) : (
        <>
          {!sessionsOnly && (
            <>
              <div className="stats-grid">
                {[
                  {
                    title: "Total conversations",
                    value: fmt(stats?.total),
                    icon: MessagesSquare,
                    detail: `${fmt(stats?.completed)} completed conversations`,
                    accent: "red",
                  },
                  {
                    title: "Active right now",
                    value: fmt(stats?.active),
                    icon: Activity,
                    detail: "Connected or getting started",
                    accent: "green",
                  },
                  {
                    title: "Conversation time",
                    value: `${Math.floor((stats?.duration ?? 0) / 60)} min`,
                    icon: Clock3,
                    detail: "Total time spent in conversation",
                    accent: "blue",
                  },
                  {
                    title: "Estimated API Cost",
                    value:
                      stats?.total && stats.incomplete === stats.total
                        ? "Unavailable"
                        : `$${Number(stats?.spend ?? 0).toFixed(2)}`,
                    icon: CircleDollarSign,
                    detail: `${fmt(stats?.incomplete)} sessions with incomplete costs`,
                    accent: "orange",
                  },
                ].map((card) => (
                  <div className="stat-card" key={card.title}>
                    <div>
                      <span>{card.title}</span>
                      <span className={`stat-icon ${card.accent}`}>
                        <card.icon size={18} />
                      </span>
                    </div>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </div>
                ))}
              </div>
              <div className="chart-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Conversation activity</h2>
                      <p>A moment of connection, day by day.</p>
                    </div>
                    <select
                      aria-label="Chart interval"
                      value={interval}
                      onChange={(e) => setIntervalValue(e.target.value)}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div className="chart">
                    {!data?.chart.length ? (
                      <div className="chart-empty">
                        Conversations will appear here.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={data.chart}
                          margin={{ left: -25, right: 15, top: 15, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="activityFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#db3c42"
                                stopOpacity={0.18}
                              />
                              <stop
                                offset="100%"
                                stopColor="#db3c42"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="#f0efee"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#8a8990" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => String(v).slice(5)}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "#8a8990" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip />
                          <Area
                            isAnimationActive={false}
                            dataKey="sessions"
                            name="Conversations"
                            type="monotone"
                            stroke="#da4248"
                            strokeWidth={2.5}
                            fill="url(#activityFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="chart-footer">
                    <span>
                      <i />
                      Conversations
                    </span>
                    <span>
                      {fmt(stats?.failed)} failed, expired or disconnected
                    </span>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Estimated spending</h2>
                      <p>Available API estimates in USD.</p>
                    </div>
                    <span className="subtle-tag">USD</span>
                  </div>
                  <div className="chart">
                    {!data?.chart.length ? (
                      <div className="chart-empty">No spending data yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.chart}
                          margin={{ left: -15, right: 15, top: 15, bottom: 0 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            stroke="#f0efee"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#8a8990" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => String(v).slice(5)}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#8a8990" }}
                            tickFormatter={(v) => `$${v}`}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip />
                          <Bar
                            isAnimationActive={false}
                            dataKey="spend"
                            name="Estimated USD"
                            fill="#e9a1a2"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={24}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="chart-footer">
                    <span>
                      <i className="pink" />
                      Estimated API Cost
                    </span>
                    <Link href="/admin/pricing">
                      Manage pricing <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </section>
              </div>
              <div className="insight-strip">
                <Info size={17} />
                <span>
                  Browser-reported usage is provisional. Incomplete estimates
                  are excluded from spending totals.
                </span>
                <span className="token-total">
                  {fmt(stats?.tokens)} available tokens
                </span>
              </div>
            </>
          )}
          <section className="panel sessions-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {sessionsOnly
                    ? "Conversation history"
                    : "Recent conversations"}
                </h2>
                <p>
                  {sessionsOnly
                    ? "Search by session ID, model, or language."
                    : "The latest conversations with your assistant."}
                </p>
              </div>
              {!sessionsOnly && (
                <Link className="text-link" href="/admin/sessions">
                  View all conversations <ArrowRight size={15} />
                </Link>
              )}
            </div>
            {sessionsOnly && (
              <form
                className="session-filters"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQ(search);
                  setPage(1);
                }}
              >
                <label className="search-field">
                  <Search size={17} />
                  <input
                    placeholder="Search conversations…"
                    aria-label="Search conversations"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="outline" size="sm">
                  Search
                </Button>
                <select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    "CREATED",
                    "CONNECTING",
                    "ACTIVE",
                    "COMPLETED",
                    "DISCONNECTED",
                    "FAILED",
                    "EXPIRED",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </form>
            )}
            <SessionTable
              rows={sessionsOnly ? rows : (data?.recent ?? [])}
              timezone={timezone}
            />
            {sessionsOnly && (
              <div className="pagination">
                <span>
                  {total} conversations · Page {page} of{" "}
                  {Math.max(1, Math.ceil(total / 10))}
                </span>
                <div>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page * 10 >= total}
                    onClick={() => setPage(page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={17} />
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      <div className="refresh-note">
        <CheckCircle2 size={13} />
        {refreshed
          ? `Last refreshed ${new Date(refreshed).toLocaleTimeString("en-GB", { timeZone: timezone })} · ${timezone} · Refreshes every 30 seconds`
          : "Waiting for first update"}
      </div>
    </>
  );
}
