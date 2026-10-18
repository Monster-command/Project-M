"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { StockChart } from "@/components/StockChart";
import { Card, ChangeBadge, EmptyState, ErrorState, Freshness, Skeleton } from "@/components/ui";
import { fmtPct, fmtPrice, fmtSigned, fmtVolume, cx } from "@/lib/format";

interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  week52High: number | null;
  week52Low: number | null;
  perChange30d: number | null;
  timestamp: string | null;
}
interface HistResp {
  symbol: string;
  bars: Bar[];
  returnPct: number;
  corporateActions: Array<{ type: string; exDate: string; detail: string }>;
  corporateActionWarning: string | null;
  asOf: string;
  stale: boolean;
  marketOpen: boolean;
}
interface W52Resp {
  high: number | null;
  low: number | null;
  highDate: string | null;
  lowDate: string | null;
  currentPrice: number | null;
  positionPct: number | null;
  corporateActionWarning: string | null;
}

const RANGES = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "3Y", months: 36 },
  { label: "5Y", months: 60 },
];

export default function StockPage({ params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const [range, setRange] = useState(12);
  const quote = useApi<{ quote: Quote; asOf: string; stale: boolean; marketOpen: boolean }>(
    `/api/quote?symbol=${symbol}`,
  );
  const hist = useApi<HistResp>(`/api/history?symbol=${symbol}&months=${range}`);
  const w52 = useApi<W52Resp>(`/api/52w?symbol=${symbol}`);

  const q = quote.data?.quote;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {quote.error ? (
        <ErrorState message={quote.error} onRetry={quote.retry} />
      ) : !q ? (
        <Skeleton className="h-28" />
      ) : (
        <header className="rise-in">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{q.symbol}</h1>
            <p className="tnum text-3xl font-bold">{fmtPrice(q.price)}</p>
            <p className="tnum text-lg">
              <ChangeBadge value={q.changePercent} />
              <span className="ml-2 text-sm text-[var(--faint)]">({fmtSigned(q.change)})</span>
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Open", fmtPrice(q.open)],
              ["High", fmtPrice(q.high)],
              ["Low", fmtPrice(q.low)],
              ["Prev close", fmtPrice(q.prevClose)],
              ["Volume", fmtVolume(q.volume)],
              ["30-day", q.perChange30d != null ? fmtPct(q.perChange30d) : "—"],
              ["52W range", q.week52High != null ? `${fmtPrice(q.week52Low!)} – ${fmtPrice(q.week52High)}` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-[var(--panel)] border border-[var(--border)] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{k}</p>
                <p className="tnum mt-0.5 text-[13px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Freshness asOf={quote.data?.asOf} stale={quote.data?.stale} marketOpen={quote.data?.marketOpen} />
          </div>
        </header>
      )}

      {/* Chart */}
      <Card className="mt-6 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Price history</h2>
          <div className="flex gap-1" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.months)}
                className={cx(
                  "focus-ring rounded-md px-2.5 py-1 text-xs font-medium",
                  range === r.months
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--panel2)]",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {hist.loading ? (
          <Skeleton className="h-[420px]" />
        ) : hist.error ? (
          <ErrorState message={hist.error} onRetry={hist.retry} />
        ) : hist.data && hist.data.bars.length > 0 ? (
          <>
            <StockChart bars={hist.data.bars} />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[var(--muted)]">
              <span>Period return <ChangeBadge value={hist.data.returnPct} /></span>
              <span className="tnum">{hist.data.bars.length} trading days</span>
              {hist.data.corporateActionWarning && (
                <span className="text-[var(--down)]">⚠ {hist.data.corporateActionWarning}</span>
              )}
            </div>
            {hist.data.corporateActions.length > 0 && (
              <details className="mt-2 text-[12px] text-[var(--muted)]">
                <summary className="cursor-pointer hover:text-[var(--ink)]">
                  Corporate actions in period ({hist.data.corporateActions.length})
                </summary>
                <ul className="mt-1 list-disc pl-5">
                  {hist.data.corporateActions.slice(0, 10).map((c, i) => (
                    <li key={i}>{c.exDate} — {c.type}{c.detail ? `: ${c.detail}` : ""}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <EmptyState title="No price history available" />
        )}
      </Card>

      {/* 52-week position */}
      <Card className="mt-4 p-5">
        <h2 className="mb-3 text-sm font-semibold">52-week position</h2>
        {w52.loading ? (
          <Skeleton className="h-16" />
        ) : w52.error || !w52.data ? (
          <ErrorState message={w52.error ?? "Unavailable"} />
        ) : (
          <>
            <div className="flex justify-between text-[12px] text-[var(--muted)]">
              <span>Low <span className="tnum font-semibold text-[var(--ink)]">{fmtPrice(w52.data.low)}</span>{w52.data.lowDate ? ` · ${w52.data.lowDate}` : ""}</span>
              <span>High <span className="tnum font-semibold text-[var(--ink)]">{fmtPrice(w52.data.high)}</span>{w52.data.highDate ? ` · ${w52.data.highDate}` : ""}</span>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-[var(--panel2)]" role="img" aria-label={`Price at ${w52.data.positionPct?.toFixed(0) ?? "—"} percent of 52-week range`}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.max(0, w52.data.positionPct ?? 0))}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              Current price sits at <span className="tnum font-semibold text-[var(--ink)]">{w52.data.positionPct?.toFixed(1) ?? "—"}%</span> of the 52-week range.
              {w52.data.corporateActionWarning && <span className="text-[var(--down)]"> ⚠ {w52.data.corporateActionWarning}</span>}
            </p>
          </>
        )}
      </Card>

      <p className="mt-6 text-[11px] text-[var(--faint)]">
        History: daily NSE bhavcopy (unadjusted). For education and research only — not investment advice.
      </p>
    </div>
  );
}
