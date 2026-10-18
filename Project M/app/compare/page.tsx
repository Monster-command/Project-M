"use client";
import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/components/useApi";
import { CompareChart, SERIES_COLORS } from "@/components/CompareChart";
import { Card, ChangeBadge, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui";
import { fmtPct, cx } from "@/lib/format";

interface CompareResp {
  symbols: string[];
  months: number;
  results: Array<{ symbol: string; returnPct: number | null; maxDrawdownPct: number | null }>;
  warnings: string[];
  series: Array<{ symbol: string; points: Array<{ date: string; value: number }> }>;
  stale: boolean;
}

const MONTHS = [3, 6, 12, 36, 60];

export default function Compare() {
  const [input, setInput] = useState("TCS, INFY, HCLTECH, WIPRO");
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<CompareResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const symbols = [...new Set(input.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (symbols.length < 2) {
      setError("Enter 2–5 symbols separated by commas.");
      return;
    }
    if (symbols.length > 5) {
      setError("Compare supports at most 5 symbols.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await postJson<CompareResp>("/api/compare", { symbols, months });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const chartSeries = (data?.series ?? []).map((s, i) => ({
    ...s,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Compare</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Analyze stocks side by side, normalized to 100.</p>

      <Card className="mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label htmlFor="cmp-symbols" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
              Symbols (2–5, comma separated)
            </label>
            <input
              id="cmp-symbols"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="TCS, INFY, HCLTECH"
              className="focus-ring w-full rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-sm uppercase outline-none placeholder:text-[var(--faint)] placeholder:normal-case"
            />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">Period</span>
            <div className="flex gap-1">
              {MONTHS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={cx(
                    "focus-ring rounded-md px-2.5 py-2 text-xs font-medium",
                    months === m ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--panel2)]",
                  )}
                >
                  {m >= 12 ? `${m / 12}Y` : `${m}M`}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="focus-ring rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Running…" : "Compare"}
          </button>
        </div>
      </Card>

      {error && <div className="mt-4"><ErrorState message={error} /></div>}
      {loading && <Skeleton className="mt-4 h-96" />}

      {data && !loading && (
        <div className="mt-4 grid gap-4">
          <Card className="p-5">
            <SectionTitle title="Normalized performance" sub={`Base 100 at start · ${months >= 12 ? months / 12 + "Y" : months + "M"}`} />
            {chartSeries.some((s) => s.points.length) ? (
              <CompareChart series={chartSeries} />
            ) : (
              <EmptyState title="No chart data" sub="Histories could not be loaded for these symbols." />
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle title="Returns & drawdown" />
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
                  {[...data.results]
                    .sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity))
                    .map((r) => (
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
            <p className="mt-2 text-[11px] text-[var(--faint)]">
              Returns use unadjusted NSE bhavcopy prices. {data.stale ? "Market closed — figures reflect the last close." : ""}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
