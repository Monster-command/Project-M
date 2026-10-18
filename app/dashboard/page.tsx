"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Sparkline } from "@/components/Sparkline";
import { Card, ChangeBadge, EmptyState, ErrorState, Freshness, SectionTitle, Skeleton } from "@/components/ui";
import { fmtPrice, fmtVolume, cx } from "@/lib/format";

interface IndexRow {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  spark: number[];
}
interface IndicesResp {
  indices: IndexRow[];
  asOf: string;
  stale: boolean;
  marketOpen: boolean;
}
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
  asOf: string;
  stale: boolean;
  marketOpen: boolean;
}
interface BreadthResp {
  date: string;
  breadth: { advances: number; declines: number; unchanged: number; adRatio: number | null };
  asOf: string;
  stale: boolean;
}

function MoversTable({ rows, showVolume = true }: { rows: Mover[]; showVolume?: boolean }) {
  if (!rows.length) return <EmptyState title="No data right now" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Symbol</th>
            <th className="py-2 pr-2 text-right font-medium">Price</th>
            <th className="py-2 pr-2 text-right font-medium">Chg %</th>
            {showVolume && <th className="py-2 text-right font-medium">Volume</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((r, i) => (
            <tr key={r.symbol} className="border-t border-[var(--border)]">
              <td className="py-2 pr-2 text-[var(--faint)]">{i + 1}</td>
              <td className="py-2 pr-2">
                <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-[var(--accent)] hover:underline">
                  {r.symbol}
                </Link>
              </td>
              <td className="tnum py-2 pr-2 text-right">{fmtPrice(r.price)}</td>
              <td className="py-2 pr-2 text-right"><ChangeBadge value={r.changePercent} /></td>
              {showVolume && <td className="tnum py-2 text-right text-[var(--muted)]">{fmtVolume(r.volume)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreadthPanel() {
  const { data, error, loading } = useApi<BreadthResp>("/api/breadth");
  if (loading) return <Skeleton className="h-40" />;
  if (error || !data) return <ErrorState message={error ?? "Breadth unavailable"} />;
  const b = data.breadth;
  const total = b.advances + b.declines + b.unchanged || 1;
  const advPct = (b.advances / total) * 100;
  const decPct = (b.declines / total) * 100;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--panel2)]" role="img" aria-label={`Advances ${b.advances}, declines ${b.declines}`}>
        <div className="bg-[var(--up)]" style={{ width: `${advPct}%` }} />
        <div className="bg-[var(--down)]" style={{ width: `${decPct}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Advances", v: b.advances, c: "text-[var(--up)]" },
          { label: "Declines", v: b.declines, c: "text-[var(--down)]" },
          { label: "Unchanged", v: b.unchanged, c: "text-[var(--muted)]" },
        ].map((x) => (
          <div key={x.label} className="rounded-lg bg-[var(--panel2)] p-3">
            <p className={cx("tnum text-xl font-bold", x.c)}>{x.v.toLocaleString("en-IN")}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">{x.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--faint)]">
        A/D ratio {b.adRatio != null ? b.adRatio.toFixed(2) : "—"} · {data.date}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const ix = useApi<IndicesResp>("/api/indices");
  const mv = useApi<MoversResp>("/api/movers?limit=10");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Project M</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Indian market intelligence, powered by NSE data and AI.</p>
        <div className="mt-2">
          <Freshness asOf={ix.data?.asOf} stale={ix.data?.stale} marketOpen={ix.data?.marketOpen} />
        </div>
      </div>

      {/* Index cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ix.loading &&
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        {ix.error && (
          <div className="sm:col-span-2 lg:col-span-5">
            <ErrorState message={ix.error} onRetry={ix.retry} />
          </div>
        )}
        {ix.data?.indices.map((r) => (
          <Card key={r.name} className="rise-in p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">{r.name}</p>
            <p className="tnum mt-1.5 text-2xl font-bold tracking-tight">
              {r.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div>
                <ChangeBadge value={r.changePercent} />
                <p className="tnum text-[11px] text-[var(--faint)]">
                  {r.change >= 0 ? "+" : ""}{r.change.toFixed(2)}
                </p>
              </div>
              <Sparkline values={r.spark} width={84} height={30} />
            </div>
          </Card>
        ))}
      </div>

      {/* Market overview panels */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Top Gainers" sub="By % change, all NSE securities" />
          {mv.loading ? <Skeleton className="h-48" /> : mv.error ? <ErrorState message={mv.error} onRetry={mv.retry} /> : <MoversTable rows={mv.data?.gainers ?? []} />}
        </Card>
        <Card className="p-5">
          <SectionTitle title="Top Losers" sub="By % change, all NSE securities" />
          {mv.loading ? <Skeleton className="h-48" /> : mv.error ? <ErrorState message={mv.error} onRetry={mv.retry} /> : <MoversTable rows={mv.data?.losers ?? []} />}
        </Card>
        <Card className="p-5">
          <SectionTitle title="Most Active" sub="By traded volume" />
          {mv.loading ? <Skeleton className="h-48" /> : mv.error ? <ErrorState message={mv.error} onRetry={mv.retry} /> : <MoversTable rows={mv.data?.mostActive ?? []} />}
        </Card>
        <Card className="p-5">
          <SectionTitle title="Market Breadth" sub="Advances vs declines" />
          <BreadthPanel />
        </Card>
      </div>

      <p className="mt-8 text-[11px] text-[var(--faint)]">
        Data: NSE via official MCP servers. For education and research only — not investment advice.
      </p>
    </div>
  );
}
