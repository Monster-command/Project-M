"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtPrice } from "@/lib/format";

interface Hit {
  symbol: string;
  name?: string;
  price?: number;
}

const QUICK = [
  { label: "Top gainers today", run: (r: string) => `/analyst?q=${encodeURIComponent("What are today's biggest gainers?")}` },
  { label: "Market breadth", run: () => `/analyst?q=${encodeURIComponent("Compare today's breadth")}` },
  { label: "Compare workspace", run: () => "/compare" },
  { label: "Quant Lab", run: () => "/quant" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open ]);

  const search = useCallback((v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(v.trim())}`);
        const d = await r.json();
        setHits(d.results ?? []);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 250);
  }, []);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const lower = q.toLowerCase();
  const smart: Array<{ label: string; sub: string; href: string }> = [];
  if (lower.includes("compar")) smart.push({ label: "Open comparison workspace", sub: "Compare up to 5 stocks", href: "/compare" });
  if (lower.includes("gainer") || lower.includes("top")) smart.push({ label: "Ask AI: top gainers today", sub: "AI Analyst", href: `/analyst?q=${encodeURIComponent(q)}` });
  if (lower.includes("breadth")) smart.push({ label: "Ask AI: market breadth", sub: "AI Analyst", href: `/analyst?q=${encodeURIComponent(q)}` });

  const items: Array<{ key: string; label: string; sub: string; href: string }> = [
    ...smart.map((s, i) => ({ key: `s${i}`, ...s })),
    ...hits.map((h) => ({
      key: h.symbol,
      label: h.symbol,
      sub: `${h.name ?? "NSE listed"}${h.price != null ? ` · ${fmtPrice(h.price)}` : ""}`,
      href: `/stock/${h.symbol}`,
    })),
    ...(q.trim().length >= 2
      ? QUICK.filter((x) => x.label.toLowerCase().includes(lower)).map((x) => ({
          key: x.label,
          label: x.label,
          sub: "Quick action",
          href: x.run(q),
        }))
      : []),
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
      if (e.key === "Enter" && items[active]) go(items[active].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div
        className="card w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search stocks, indices, or ask…"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-[var(--faint)]"
          aria-label="Search"
        />
        <div className="max-h-72 overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--faint)]">
              Type a symbol like RELIANCE, or try “top gainers today”.
            </p>
          )}
          {items.map((it, i) => (
            <button
              key={it.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it.href)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] ${
                i === active ? "bg-[var(--panel2)]" : ""
              }`}
            >
              <span className="font-medium text-[var(--ink)]">{it.label}</span>
              <span className="ml-3 truncate text-xs text-[var(--faint)]">{it.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
