"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { fmtPrice } from "@/lib/format";

interface Hit {
  symbol: string;
  name?: string;
  price?: number;
}

const POPULAR = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "TATAMOTORS", "AXISBANK", "KOTAKBANK"];

function StocksInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (v: string) => {
    const query = v.trim();
    if (query.length < 2) {
      setHits(null);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      setHits(d.results ?? []);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = params.get("q");
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Stocks</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Search NSE-listed symbols.</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Try RELIANCE, Tata Motors, HDFC…"
        className="focus-ring mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-[15px] outline-none placeholder:text-[var(--faint)]"
        aria-label="Search stocks"
      />
      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-40" />
        ) : hits ? (
          hits.length === 0 ? (
            <EmptyState title="No matches" sub="Check the spelling or try a company name." />
          ) : (
            <Card className="divide-y divide-[var(--border)]">
              {hits.map((h) => (
                <Link key={h.symbol} href={`/stock/${h.symbol}`} className="focus-ring flex items-center justify-between px-4 py-3 hover:bg-[var(--panel2)]">
                  <div>
                    <p className="font-semibold">{h.symbol}</p>
                    {h.name && <p className="text-[12px] text-[var(--faint)]">{h.name}</p>}
                  </div>
                  {h.price != null && <p className="tnum text-sm">{fmtPrice(h.price)}</p>}
                </Link>
              ))}
            </Card>
          )
        ) : (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">Popular</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((s) => (
                <Link key={s} href={`/stock/${s}`} className="focus-ring rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-[13px] font-medium hover:border-[var(--faint)]">
                  {s}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Stocks() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-6"><Skeleton className="h-40" /></div>}>
      <StocksInner />
    </Suspense>
  );
}
