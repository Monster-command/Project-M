"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { postJson } from "@/components/useApi";
import { Card, ChangeBadge, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui";
import { fmtPrice, fmtVolume, cx } from "@/lib/format";
import { UNIVERSES } from "@/lib/universe";

interface Row {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  returnPct: number | null;
  w52High: number | null;
  w52Low: number | null;
  distFrom52wHighPct: number | null;
}
interface ScreenResp {
  matched: number;
  scanned: number;
  rows: Row[];
  warnings: string[];
}
interface SavedScreen {
  name: string;
  universe: string;
  conditions: Record<string, number | undefined>;
  savedAt: string;
}

type SortKey = "symbol" | "price" | "changePercent" | "volume" | "returnPct" | "distFrom52wHighPct" | "w52High" | "w52Low";

export default function Quant() {
  const [universe, setUniverse] = useState("NIFTY50");
  const [customSyms, setCustomSyms] = useState("");
  const [minReturn, setMinReturn] = useState("10");
  const [useReturn, setUseReturn] = useState(true);
  const [returnMonths, setReturnMonths] = useState(12);
  const [minVolume, setMinVolume] = useState("");
  const [maxDistHigh, setMaxDistHigh] = useState("");
  const [data, setData] = useState<ScreenResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("returnPct");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [saved, setSaved] = useState<SavedScreen[]>([]);
  const [screenName, setScreenName] = useState("");

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("nsei-screens") ?? "[]"));
    } catch {
      /* ignore */
    }
  }, []);

  const conditions = () => {
    const c: Record<string, number | undefined> = {};
    if (useReturn && minReturn.trim() !== "") {
      c.minReturnPct = parseFloat(minReturn);
      c.returnMonths = returnMonths;
    }
    if (minVolume.trim() !== "") c.minVolume = parseFloat(minVolume);
    if (maxDistHigh.trim() !== "") c.maxDist52wHighPct = parseFloat(maxDistHigh);
    return c;
  };

  const run = async (preset?: { universe: string; conditions: Record<string, number | undefined> }) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const d = await postJson<ScreenResp>("/api/screen", {
        universe: preset?.universe ?? universe,
        symbols: universe === "CUSTOM" ? customSyms.split(/[,\s]+/).filter(Boolean) : undefined,
        conditions: preset?.conditions ?? conditions(),
      });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screen failed.");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    const name = screenName.trim() || `Screen ${saved.length + 1}`;
    const next = [...saved, { name, universe, conditions: conditions(), savedAt: new Date().toISOString() }];
    setSaved(next);
    localStorage.setItem("nsei-screens", JSON.stringify(next));
    setScreenName("");
  };

  const sorted = data ? [...data.rows].sort((a, b) => {
    const av = a[sortKey] ?? (sortKey === "symbol" ? "" : -Infinity);
    const bv = b[sortKey] ?? (sortKey === "symbol" ? "" : -Infinity);
    if (typeof av === "string") return av.localeCompare(bv as string) * dir;
    return ((av as number) - (bv as number)) * dir;
  }) : [];

  const th = (label: string, key: SortKey, numeric = true) => (
    <th className={cx("py-2 pr-3 font-medium", numeric && "text-right")}>
      <button
        onClick={() => {
          if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1));
          else {
            setSortKey(key);
            setDir(key === "symbol" ? 1 : -1);
          }
        }}
        className="hover:text-[var(--ink)]"
      >
        {label} {sortKey === key ? (dir === -1 ? "↓" : "↑") : ""}
      </button>
    </th>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Quant Lab</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Turn market data into quantitative signals.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit p-5">
          <SectionTitle title="Build screen" />
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]" htmlFor="q-universe">
            Universe
          </label>
          <select
            id="q-universe"
            value={universe}
            onChange={(e) => setUniverse(e.target.value)}
            className="focus-ring w-full rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-sm outline-none"
          >
            {Object.entries(UNIVERSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label} — {v.note}</option>
            ))}
            <option value="CUSTOM">Custom symbols</option>
          </select>
          {universe === "CUSTOM" && (
            <input
              value={customSyms}
              onChange={(e) => setCustomSyms(e.target.value)}
              placeholder="RELIANCE, TCS, INFY"
              className="focus-ring mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-2 text-sm uppercase outline-none"
              aria-label="Custom symbols"
            />
          )}

          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">Conditions (AND)</p>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={useReturn} onChange={(e) => setUseReturn(e.target.checked)} className="accent-[var(--accent)]" />
              Return &gt;
              <input
                value={minReturn}
                onChange={(e) => setMinReturn(e.target.value)}
                inputMode="decimal"
                className="focus-ring w-20 rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-[13px] outline-none"
                aria-label="Minimum return percent"
              />
              % over
              <select value={returnMonths} onChange={(e) => setReturnMonths(parseInt(e.target.value, 10))} className="focus-ring rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-[13px]" aria-label="Return period">
                {[3, 6, 12, 24, 60].map((m) => <option key={m} value={m}>{m >= 12 ? `${m / 12}Y` : `${m}M`}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              Volume &gt;
              <input
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 1000000"
                className="focus-ring w-36 rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-[13px] outline-none"
                aria-label="Minimum volume"
              />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              Within
              <input
                value={maxDistHigh}
                onChange={(e) => setMaxDistHigh(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 5"
                className="focus-ring w-20 rounded-md border border-[var(--border)] bg-[var(--panel2)] px-2 py-1 text-[13px] outline-none"
                aria-label="Max percent below 52-week high"
              />
              % of 52W high
            </label>
          </div>

          <button
            onClick={() => run()}
            disabled={loading}
            className="focus-ring mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Running screen…" : "Run screen"}
          </button>

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">Saved screens</p>
            <div className="flex gap-2">
              <input
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                placeholder="Name this screen"
                className="focus-ring min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-1.5 text-[13px] outline-none"
                aria-label="Screen name"
              />
              <button onClick={save} className="focus-ring rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--panel2)]">
                Save
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {saved.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--panel2)] px-3 py-2 text-[13px]">
                  <button onClick={() => { setUniverse(s.universe); run({ universe: s.universe, conditions: s.conditions }); }} className="font-medium hover:text-[var(--accent)] hover:underline">
                    {s.name}
                  </button>
                  <button
                    onClick={() => {
                      const next = saved.filter((_, j) => j !== i);
                      setSaved(next);
                      localStorage.setItem("nsei-screens", JSON.stringify(next));
                    }}
                    className="text-[var(--faint)] hover:text-[var(--down)]"
                    aria-label={`Delete ${s.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {saved.length === 0 && <p className="text-[12px] text-[var(--faint)]">No saved screens yet.</p>}
            </div>
          </div>
        </Card>

        <div>
          {error && <ErrorState message={error} />}
          {loading && <Skeleton className="h-96" />}
          {data && !loading && (
            <Card className="p-5">
              <SectionTitle title={`Results — ${data.matched} of ${data.scanned} matched`} />
              {data.rows.length === 0 ? (
                <EmptyState title="No matches" sub="Loosen a condition and run again." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
                        {th("Symbol", "symbol", false)}
                        {th("Price", "price")}
                        {th("Return", "returnPct")}
                        {th("Volume", "volume")}
                        {th("52W high", "w52High")}
                        {th("52W low", "w52Low")}
                        {th("Below high", "distFrom52wHighPct")}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => (
                        <tr key={r.symbol} className="border-t border-[var(--border)]">
                          <td className="py-2 pr-3">
                            <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-[var(--accent)] hover:underline">
                              {r.symbol}
                            </Link>
                          </td>
                          <td className="tnum py-2 pr-3 text-right">{fmtPrice(r.price)}</td>
                          <td className="py-2 pr-3 text-right">{r.returnPct != null ? <ChangeBadge value={r.returnPct} /> : <span className="text-[var(--faint)]">—</span>}</td>
                          <td className="tnum py-2 pr-3 text-right text-[var(--muted)]">{fmtVolume(r.volume)}</td>
                          <td className="tnum py-2 pr-3 text-right">{r.w52High != null ? fmtPrice(r.w52High) : "—"}</td>
                          <td className="tnum py-2 pr-3 text-right">{r.w52Low != null ? fmtPrice(r.w52Low) : "—"}</td>
                          <td className="tnum py-2 text-right text-[var(--muted)]">
                            {r.distFrom52wHighPct != null ? `${r.distFrom52wHighPct.toFixed(2)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.warnings.map((w) => (
                <p key={w} className="mt-2 text-[11px] text-[var(--faint)]">⚠ {w}</p>
              ))}
            </Card>
          )}
          {!data && !loading && !error && (
            <Card className="p-10 text-center">
              <p className="text-sm text-[var(--muted)]">Configure conditions and run a screen to see results.</p>
              <p className="mt-1 text-[12px] text-[var(--faint)]">Example: NIFTY 50, 12M return &gt; 10%, within 5% of 52-week high.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
