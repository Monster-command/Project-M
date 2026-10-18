"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "@/components/useApi";
import { Card, ChangeBadge, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui";
import { fmtPrice, fmtVolume, cx } from "@/lib/format";

interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}
interface BulkQuote {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
}

const DEFAULTS: Watchlist[] = [
  { id: "default", name: "My Stocks", symbols: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"] },
];

function load(): Watchlist[] {
  try {
    const raw = localStorage.getItem("nsei-watchlists");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export default function WatchlistPage() {
  const [lists, setLists] = useState<Watchlist[]>(DEFAULTS);
  const [activeId, setActiveId] = useState("default");
  const [newListName, setNewListName] = useState("");
  const [addSym, setAddSym] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");

  useEffect(() => {
    const l = load();
    setLists(l);
    if (!l.find((x) => x.id === activeId)) setActiveId(l[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: Watchlist[]) => {
    setLists(next);
    localStorage.setItem("nsei-watchlists", JSON.stringify(next));
  };

  const active = lists.find((l) => l.id === activeId);
  const { data, error, loading } = useApi<{ quotes: BulkQuote[] }>(
    active && active.symbols.length ? `/api/bulk?symbols=${active.symbols.join(",")}` : null,
  );
  const bySym = new Map((data?.quotes ?? []).map((q) => [q.symbol, q]));

  const mutate = (id: string, fn: (l: Watchlist) => Watchlist) =>
    persist(lists.map((l) => (l.id === id ? fn(l) : l)));

  const move = (i: number, dir: -1 | 1) => {
    if (!active) return;
    const syms = [...active.symbols];
    const j = i + dir;
    if (j < 0 || j >= syms.length) return;
    [syms[i], syms[j]] = [syms[j], syms[i]];
    mutate(active.id, (l) => ({ ...l, symbols: syms }));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Your lists live in this browser.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveId(l.id)}
            className={cx(
              "focus-ring rounded-full border px-4 py-1.5 text-[13px] font-medium",
              l.id === activeId
                ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]",
            )}
          >
            {l.name} <span className="text-[var(--faint)]">({l.symbols.length})</span>
          </button>
        ))}
        <div className="flex gap-1.5">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name"
            className="focus-ring w-36 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[13px] outline-none"
            aria-label="New watchlist name"
          />
          <button
            onClick={() => {
              const name = newListName.trim();
              if (!name) return;
              const id = `wl-${Date.now()}`;
              persist([...lists, { id, name, symbols: [] }]);
              setActiveId(id);
              setNewListName("");
            }}
            className="focus-ring rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--panel2)]"
          >
            + Add
          </button>
        </div>
      </div>

      {active && (
        <Card className="mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            {renaming ? (
              <div className="flex gap-2">
                <input
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-1.5 text-sm outline-none"
                  aria-label="Watchlist name"
                />
                <button
                  onClick={() => {
                    if (renameVal.trim()) mutate(active.id, (l) => ({ ...l, name: renameVal.trim() }));
                    setRenaming(false);
                  }}
                  className="focus-ring rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-ink)]"
                >
                  Save
                </button>
              </div>
            ) : (
              <SectionTitle title={active.name} />
            )}
            <div className="flex gap-2">
              {!renaming && (
                <button
                  onClick={() => {
                    setRenameVal(active.name);
                    setRenaming(true);
                  }}
                  className="focus-ring rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] hover:bg-[var(--panel2)]"
                >
                  Rename
                </button>
              )}
              {lists.length > 1 && (
                <button
                  onClick={() => {
                    const next = lists.filter((l) => l.id !== active.id);
                    persist(next);
                    setActiveId(next[0].id);
                  }}
                  className="focus-ring rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--down)] hover:bg-[var(--panel2)]"
                >
                  Delete list
                </button>
              )}
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={addSym}
              onChange={(e) => setAddSym(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && addSym.trim()) {
                  const s = addSym.trim().toUpperCase();
                  if (!active.symbols.includes(s)) mutate(active.id, (l) => ({ ...l, symbols: [...l.symbols, s] }));
                  setAddSym("");
                }
              }}
              placeholder="Add symbol, e.g. SBIN"
              className="focus-ring w-56 rounded-lg border border-[var(--border)] bg-[var(--panel2)] px-3 py-1.5 text-sm uppercase outline-none"
              aria-label="Add symbol"
            />
            <button
              onClick={() => {
                const s = addSym.trim().toUpperCase();
                if (!s) return;
                if (!active.symbols.includes(s)) mutate(active.id, (l) => ({ ...l, symbols: [...l.symbols, s] }));
                setAddSym("");
              }}
              className="focus-ring rounded-lg bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-[var(--accent-ink)] hover:opacity-90"
            >
              Add
            </button>
          </div>

          {loading ? (
            <Skeleton className="h-48" />
          ) : error ? (
            <ErrorState message={error} />
          ) : active.symbols.length === 0 ? (
            <EmptyState title="This list is empty" sub="Add symbols above to start tracking them." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
                    <th className="py-2 pr-3 font-medium">Symbol</th>
                    <th className="py-2 pr-3 text-right font-medium">Price</th>
                    <th className="py-2 pr-3 text-right font-medium">Chg %</th>
                    <th className="py-2 pr-3 text-right font-medium">Volume</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {active.symbols.map((s, i) => {
                    const q = bySym.get(s);
                    return (
                      <tr key={s} className="border-t border-[var(--border)]">
                        <td className="py-2 pr-3">
                          <Link href={`/stock/${s}`} className="font-semibold hover:text-[var(--accent)] hover:underline">
                            {s}
                          </Link>
                        </td>
                        <td className="tnum py-2 pr-3 text-right">{q ? fmtPrice(q.price) : "…"}</td>
                        <td className="py-2 pr-3 text-right">{q ? <ChangeBadge value={q.changePercent} /> : "…"}</td>
                        <td className="tnum py-2 pr-3 text-right text-[var(--muted)]">{q ? fmtVolume(q.volume) : "…"}</td>
                        <td className="py-2 text-right">
                          <span className="inline-flex gap-1">
                            <button onClick={() => move(i, -1)} disabled={i === 0} className="focus-ring rounded px-1.5 py-0.5 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" aria-label={`Move ${s} up`}>↑</button>
                            <button onClick={() => move(i, 1)} disabled={i === active.symbols.length - 1} className="focus-ring rounded px-1.5 py-0.5 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" aria-label={`Move ${s} down`}>↓</button>
                            <button onClick={() => mutate(active.id, (l) => ({ ...l, symbols: l.symbols.filter((x) => x !== s) }))} className="focus-ring rounded px-1.5 py-0.5 text-[var(--faint)] hover:text-[var(--down)]" aria-label={`Remove ${s}`}>✕</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
