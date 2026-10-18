"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Sparkline } from "@/components/Sparkline";
import { ChangeBadge, Skeleton } from "@/components/ui";
import { fmtPrice } from "@/lib/format";

interface IndicesResp {
  indices: Array<{
    name: string;
    value: number;
    changePercent: number;
    spark: number[];
  }>;
  stale: boolean;
  marketOpen: boolean;
}

function PreviewStrip() {
  const { data, loading } = useApi<IndicesResp>("/api/indices");
  if (loading)
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-52 shrink-0" />
        ))}
      </div>
    );
  if (!data) return null;
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {data.indices.slice(0, 5).map((ix) => (
        <div key={ix.name} className="card w-52 shrink-0 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">{ix.name}</p>
          <p className="tnum mt-1 text-xl font-bold">{ix.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
          <div className="mt-1 flex items-center justify-between">
            <ChangeBadge value={ix.changePercent} />
            <Sparkline values={ix.spark} width={72} height={26} />
          </div>
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    title: "Market Intelligence",
    body: "Explore Indian markets through structured NSE data — indices, movers, breadth and volume, refreshed through the session.",
    href: "/dashboard",
  },
  {
    title: "AI Analyst",
    body: "Ask natural-language questions about the market. Every answer is built from live NSE MCP data, with sources shown.",
    href: "/analyst",
  },
  {
    title: "Quant Lab",
    body: "Build quantitative screens on returns, volume and 52-week position — and save the ones that work.",
    href: "/quant",
  },
  {
    title: "Compare",
    body: "Analyze stocks side by side with base-100 normalized paths, drawdowns, beta and correlation.",
    href: "/compare",
  },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 md:pt-24">
        <p className="mb-4 inline-block rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
          Powered by NSE&apos;s official MCP servers · Educational use only
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Understand the Indian Market.
          <br />
          <span className="text-[var(--accent)]">Ask it anything.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          An AI-native market intelligence platform powered by NSE data.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="focus-ring rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-ink)] hover:opacity-90"
          >
            Explore Markets
          </Link>
          <Link
            href="/analyst"
            className="focus-ring rounded-xl border border-[var(--border)] bg-[var(--panel)] px-6 py-3 text-sm font-semibold hover:bg-[var(--panel2)]"
          >
            Ask the AI
          </Link>
        </div>
        <div className="mt-10">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[var(--faint)]">
            Live market preview
          </p>
          <PreviewStrip />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="card focus-ring group p-6 transition-colors hover:border-[var(--faint)]">
              <h3 className="text-lg font-semibold group-hover:text-[var(--accent)]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Data provenance */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="card p-6 md:p-8">
          <h3 className="text-lg font-semibold">Built on NSE Data</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Market data is sourced through NSE&apos;s MCP infrastructure — the cash-market server for
            live quotes, indices and movers, and the bhavcopy server for five years of daily history.
            Every figure on this site traces back to an NSE response. This is a research and
            education tool, not investment advice.
          </p>
          <Link href="/data-source" className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline">
            How the data works →
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-[var(--faint)]">
        Project M · Data: NSE via official MCP servers · For education and research only. Not investment advice.
      </footer>
    </div>
  );
}
