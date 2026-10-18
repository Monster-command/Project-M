"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApi, postJson } from "@/components/useApi";
import { Card, ChangeBadge, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui";
import { fmtPrice, fmtVolume, cx } from "@/lib/format";

interface Mover {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
}
interface MoversResp {
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
  stale: boolean;
  marketOpen: boolean;
}

type Tab = "overview" | "gainers" | "losers" | "volume" | "highs52" | "lows52" | "returns";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "volume", label: "Volume" },
  { id: "highs52", label: "52W Highs" },
  { id: "lows52", label: "52W Lows" },
  { id: "returns", label: "Returns" },
];

function SortTable({ rows }: { rows: Mover[] }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"changePercent" | "price" | "volume">("changePercent");
  const [dir, setDir] = useState<1 | -1>(-1);
  const filtered = useMemo(() => {
    const f = rows.filter((r) => r.symbol.includes(q.trim().toUpperCase()));
    return [...f].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
  }, [rows, q, sortKey, dir]);
  const th = (label: string, key: typeof sortKey) => (
    <th className="py-2 pr-3 font-medium">
      <button
        onClick={() => {
          if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1));
          else {
            setSortKey(key);
            setDir(-1);
          }
        }}
        className="hover:text-[var(--ink)]"
        aria-label={`Sort by ${label}`}
      >
        {label} {sortKey === key ? (dir === -1 ? "↓" : "↑") : ""}
      </button>
    </th>
  );
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter symbols…"
        className="focus-ring mb-3 w-56 rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-1.5 text-[13px] outline-none placeholder:text-[var(--faint)]"
        aria-label="Filter symbols"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
              <th className="py-2 pr-3 font-medium">Symbol</th>
              <th className="py-2 pr-3 text-right font-medium">{th("Price", "price")}</th>
              <th className="py-2 pr-3 text-right font-medium">{th("Chg %", "changePercent")}</th>
              <th className="py-2 text-right font-medium">{th("Volume", "volume")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.symbol} className="border-t border-[var(--border)]">
                <td className="py-2 pr-3">
                  <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-[var(--accent)] hover:underline">
                    {r.symbol}
                  </Link>
                </td>
                <td className="tnum py-2 pr-3 text-right">{fmtPrice(r.price)}</td>
                <td className="py-2 pr-3 text-right"><ChangeBadge value={r.changePercent} /></td>
                <td className="tnum py-2 text-right text-[var(--muted)]">{fmtVolume(r.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState title="No matching symbols" />}
      </div>
    </div>
  );
}

interface ScreenRow {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  distFrom52wHighPct: number | null;
  distFrom52wLowPct: number | null;
}

function Range52Tab({ mode }: { mode: "highs" | "lows" }) {
  const [rows, setRows] = useState<ScreenRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRows(null);
    setError(null);
    postJson<{ rows: ScreenRow[] }>("/api/screen", {
      universe: "NIFTY50",
      conditions: mode === "highs" ? { maxDist52wHighPct: 5 } : { maxDist52wLowPct: 5 },
    })
      .then((d) => {
        const sorted = [...d.rows].sort(
          (a, b) =>
            ((mode === "highs" ? a.distFrom52wHighPct : a.distFrom52wLowPct) ?? 999) -
            ((mode === "highs" ? b.distFrom52wHighPct : b.distFrom52wLowPct) ?? 999),
        );
        setRows(sorted);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [mode]);
  if (error) return <ErrorState message={error} />;
  if (!rows) return <Skeleton className="h-64" />;
  if (!rows.length)
    return <EmptyState title={mode === "highs" ? "No NIFTY 50 stock within 5% of its 52-week high" : "No NIFTY 50 stock within 5% of its 52-week low"} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
            <th className="py-2 pr-3 font-medium">Symbol</th>
            <th className="py-2 pr-3 text-right font-medium">Price</th>
            <th className="py-2 pr-3 text-right font-medium">Chg %</th>
            <th className="py-2 text-right font-medium">
              {mode === "highs" ? "Below 52W high" : "Above 52W low"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-t border-[var(--border)]">
              <td className="py-2 pr-3">
                <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-[var(--accent)] hover:underline">
                  {r.symbol}
                </Link>
              </td>
              <td className="tnum py-2 pr-3 text-right">{fmtPrice(r.price)}</td>
              <td className="py-2 pr-3 text-right"><ChangeBadge value={r.changePercent} /></td>
              <td className="tnum py-2 text-right text-[var(--muted)]">
                {(mode === "highs" ? r.distFrom52wHighPct : r.distFrom52wLowPct)?.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-[var(--faint)]">NIFTY 50 universe (indicative list). Ranges use unadjusted bhavcopy prices.</p>
    </div>
  );
}

function ReturnsTab() {
  const [months, setMonths] = useState(12);
  const { data, error, loading } = useApi<{
    rows: Array<{ symbol: string; returnPct: number; maxDrawdownPct: number | null }>;
    warnings: string[];
  }>(`/api/universe-returns?months=${months}`);
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {[3, 6, 12].map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={cx(
              "focus-ring rounded-lg border px-3 py-1.5 text-[13px] font-medium",
              months === m
                ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]",
            )}
          >
            {m}M
          </button>
        ))}
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : error || !data ? (
        <ErrorState message={error ?? "Failed to load"} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 pr-3 text-right font-medium">Return</th>
                  <th className="py-2 text-right font-medium">Max drawdown</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.symbol} className="border-t border-[var(--border)]">
                    <td className="py-2 pr-3">
                      <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-[var(--accent)] hover:underline">
                        {r.symbol}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right"><ChangeBadge value={r.returnPct} /></td>
                    <td className="tnum py-2 text-right text-[var(--down)]">
                      {r.maxDrawdownPct != null ? `${r.maxDrawdownPct.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.warnings.map((w) => (
            <p key={w} className="mt-2 text-[11px] text-[var(--faint)]">⚠ {w}</p>
          ))}
        </>
      )}
    </div>
  );
}

export default function Markets() {
  const [tab, setTab] = useState<Tab>("overview");
  const { data, error, loading } = useApi<MoversResp>("/api/movers?limit=20");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Explore NSE market data across segments.</p>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[var(--border)]" role="tablist" aria-label="Market views">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "focus-ring whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium",
              tab === t.id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading && <Skeleton className="h-64" />}
        {error && <ErrorState message={error} />}
        {data && tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5"><SectionTitle title="Top Gainers" /><SortTable rows={data.gainers.slice(0, 8)} /></Card>
            <Card className="p-5"><SectionTitle title="Top Losers" /><SortTable rows={data.losers.slice(0, 8)} /></Card>
            <Card className="p-5"><SectionTitle title="Most Active" /><SortTable rows={data.mostActive.slice(0, 8)} /></Card>
          </div>
        )}
        {data && tab === "gainers" && <Card className="p-5"><SortTable rows={data.gainers} /></Card>}
        {data && tab === "losers" && <Card className="p-5"><SortTable rows={data.losers} /></Card>}
        {data && tab === "volume" && <Card className="p-5"><SortTable rows={data.mostActive} /></Card>}
        {tab === "highs52" && <Card className="p-5"><SectionTitle title="Near 52-week highs" sub="NIFTY 50, within 5% of high" /><Range52Tab mode="highs" /></Card>}
        {tab === "lows52" && <Card className="p-5"><SectionTitle title="Near 52-week lows" sub="NIFTY 50, within 5% of low" /><Range52Tab mode="lows" /></Card>}
        {tab === "returns" && <Card className="p-5"><SectionTitle title="NIFTY 50 returns" sub="Unadjusted bhavcopy prices" /><ReturnsTab /></Card>}
      </div>
    </div>
  );
}
