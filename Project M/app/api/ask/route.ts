import { NextRequest } from "next/server";
import { bhavClient, cmClient, McpError } from "@/lib/mcp";
import {
  AskPlan,
  llmPolish,
  planAsk,
  resolvePlaceholders,
  ToolCallSpec,
} from "@/lib/analyst";
import { fmtPct, fmtPrice, fmtSigned, fmtVolume } from "@/lib/format";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Raw = Record<string, unknown>;

function pick(o: unknown, keys: string[]): number | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Raw;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function rowsOf(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  if (data && typeof data === "object") {
    const r = data as Raw;
    for (const k of ["gainers", "losers", "results", "stocks", "data", "quotes"]) {
      if (Array.isArray(r[k])) return r[k] as Raw[];
    }
  }
  return [];
}

interface ExecResult {
  spec: ToolCallSpec;
  data: unknown;
  error?: string;
}

async function execute(plan: AskPlan): Promise<ExecResult[]> {
  const out: ExecResult[] = [];
  for (const spec of plan.specs) {
    try {
      const client = spec.server === "cm" ? cmClient : bhavClient;
      const data = await client.callTool(spec.tool, resolvePlaceholders(spec.args));
      out.push({ spec, data });
    } catch (err) {
      out.push({
        spec,
        data: null,
        error: err instanceof McpError ? err.message : "tool call failed",
      });
    }
  }
  return out;
}

function topLines(rows: Raw[], n: number): string {
  return rows
    .slice(0, n)
    .map((r, i) => {
      const sym = String(r.symbol ?? "?");
      const pct = pick(r, ["perChange", "perchange", "change_pct", "changePct"]);
      const price = pick(r, ["ltp", "close", "last", "price"]);
      return `${i + 1}. ${sym} — ${price != null ? fmtPrice(price) : "—"} (${pct != null ? fmtPct(pct) : "—"})`;
    })
    .join("\n");
}

/** Compose a strictly data-grounded answer from executed tool results. */
function compose(plan: AskPlan, exec: ExecResult[]): string {
  const failed = exec.filter((e) => e.error);
  if (failed.length === exec.length) {
    return "NSE market data could not be retrieved right now.";
  }
  const byTool = (name: string) => exec.find((e) => e.spec.tool === name)?.data;

  switch (plan.intent) {
    case "movers": {
      const d = byTool("nse_get_market_movers") as Raw | null;
      if (!d) return "Movers data is unavailable right now.";
      const gainers = rowsOf(d.gainers);
      const losers = rowsOf(d.losers);
      let s = `Today's top gainers:\n${topLines(gainers, 5)}`;
      s += `\n\nToday's top losers:\n${topLines(losers, 5)}`;
      s += `\n\nFigures are % change on NSE; data refreshes every few minutes during market hours (09:15–15:30 IST).`;
      return s;
    }
    case "breadth": {
      const b = byTool("get_market_breadth") as Raw | null;
      const inner = (b && ((b as Raw).data as Raw | undefined)) ?? (b as Raw) ?? {};
      const adv = pick(inner, ["advances"]) ?? 0;
      const dec = pick(inner, ["declines"]) ?? 0;
      const unc = pick(inner, ["unchanged"]) ?? 0;
      const ad = pick(inner, ["adRatio", "ad_ratio"]);
      let s = `Market breadth — advances ${adv.toLocaleString("en-IN")}, declines ${dec.toLocaleString("en-IN")}, unchanged ${unc.toLocaleString("en-IN")}.`;
      if (ad != null) s += ` Advance/decline ratio ${ad.toFixed(2)}${ad > 1.5 ? " (bullish)" : ad < 0.7 ? " (bearish)" : ""}.`;
      const mood = byTool("get_market_mood") as Raw | null;
      // get_market_mood: {india_vix: {level, ...}, stock_breadth: {up, down, reading}, ...}
      const mi = (mood ?? {}) as Raw;
      const vix = pick((mi.india_vix ?? {}) as Raw, ["level"]);
      const reading = str(((mi.stock_breadth ?? {}) as Raw).reading);
      if (vix != null) s += ` India VIX ${vix.toFixed(2)}.`;
      if (reading) s += ` Breadth reading: ${reading}.`;
      return s;
    }
    case "compare": {
      const d = byTool("compare_stocks") as Raw | null;
      const rows = rowsOf(d);
      if (!rows.length) return "Comparison data is unavailable right now.";
      const ranked = [...rows].sort(
        (a, b) => (pick(b, ["return_pct", "returnPct"]) ?? -Infinity) - (pick(a, ["return_pct", "returnPct"]) ?? -Infinity),
      );
      let s = `12-month performance (unadjusted NSE bhavcopy prices):\n`;
      s += ranked
        .map((r) => {
          const rp = pick(r, ["return_pct", "returnPct"]);
          return `• ${r.symbol}: ${rp != null ? fmtPct(rp) : "—"}`;
        })
        .join("\n");
      // Name any requested symbol that returned no data instead of dropping it silently.
      const returned = new Set(ranked.map((r) => String(r.symbol ?? "").toUpperCase()));
      const missing = plan.symbols.filter((sym) => !returned.has(sym.toUpperCase()));
      if (missing.length) s += `\n\nNo NSE data for: ${missing.join(", ")} — check the symbol spelling.`;
      s += `\n\nPrices are not adjusted for splits/bonuses — check corporate actions before drawing conclusions.`;
      return s;
    }
    case "history": {
      const d = byTool("get_stock_history") as Raw | null;
      if (!d) return "History data is unavailable right now.";
      const sum = ((d as Raw).summary ?? {}) as Raw;
      const rp = pick(sum, ["return_pct", "returnPct"]);
      const days = pick(d, ["trading_days", "tradingDays"]);
      let s = `${plan.symbols[0]} — ${days ?? "?"} trading days, 12-month return ${rp != null ? fmtPct(rp) : "—"}.`;
      const ca = byTool("get_corporate_actions") as Raw | null;
      const events = rowsOf(ca);
      const sb = events.filter((e) => /split|bonus/i.test(String(e.type ?? "") + String(e.detail ?? "")));
      if (sb.length) s += ` Note: ${sb.length} split/bonus event(s) in the period — prices shown are unadjusted.`;
      return s;
    }
    case "index": {
      const d = byTool("cm_get_index_quote") as Raw | null;
      const idx = ((d as Raw | null)?.index ?? d ?? {}) as Raw;
      const val = pick(idx, ["last"]);
      const chg = pick(idx, ["change"]);
      const pct = pick(idx, ["percChange"]);
      const comp = (idx.comparisons ?? {}) as Raw;
      const w = (comp.oneWeekAgo ?? {}) as Raw;
      const m = (comp.oneMonthAgo ?? {}) as Raw;
      const y = (comp.oneYearAgo ?? {}) as Raw;
      let s = `${idx.indexName ?? plan.summary}: ${val != null ? val.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}`;
      if (chg != null) s += ` (${fmtSigned(chg)} / ${pct != null ? fmtPct(pct) : "—"})`;
      const parts: string[] = [];
      if (w.changePct != null) parts.push(`1W ${fmtPct(w.changePct as number)}`);
      if (m.changePct != null) parts.push(`1M ${fmtPct(m.changePct as number)}`);
      if (y.changePct != null) parts.push(`1Y ${fmtPct(y.changePct as number)}`);
      if (parts.length) s += `\nComparisons: ${parts.join(" · ")}.`;
      return s;
    }
    case "quote": {
      const d = byTool("cm_get_stock_quote") as Raw | null;
      const s0 = ((d as Raw | null)?.stock ?? d ?? {}) as Raw;
      const price = pick(s0, ["lastTradedPrice", "ltp"]);
      const chg = pick(s0, ["change"]);
      const pct = pick(s0, ["perChange", "perchange"]);
      const vol = pick(s0, ["volume"]);
      let s = `${s0.symbol ?? plan.symbols[0]}: ${price != null ? fmtPrice(price) : "—"}`;
      if (chg != null) s += ` (${fmtSigned(chg)} / ${pct != null ? fmtPct(pct) : "—"})`;
      if (vol != null) s += `, volume ${fmtVolume(vol)}`;
      s += ".";
      const w = byTool("get_52_week_high_low");
      if (w) {
        const wi = ((w as Raw).data ?? w) as Raw;
        const hi = pick(wi, ["high52", "high_52", "week52High"]);
        const lo = pick(wi, ["low52", "low_52", "week52Low"]);
        if (hi != null && lo != null) s += ` 52-week range ${fmtPrice(lo)} – ${fmtPrice(hi)}.`;
      }
      return s;
    }
    case "search": {
      const d = byTool("search_symbols") as Raw | null;
      const rows = rowsOf(d);
      if (!rows.length) return "No matching symbols found on NSE.";
      return `Matching NSE symbols:\n${rows
        .slice(0, 8)
        .map((r) => `• ${r.symbol}${r.companyName ?? r.name ? ` — ${r.companyName ?? r.name}` : ""}`)
        .join("\n")}`;
    }
    default: {
      // overview
      const idx = byTool("cm_get_index_quote") as Raw | null;
      const ix = ((idx as Raw | null)?.index ?? {}) as Raw;
      const mv = byTool("nse_get_market_movers") as Raw | null;
      let s = "";
      if (ix.last != null)
        s += `NIFTY 50 at ${Number(ix.last).toLocaleString("en-IN", { maximumFractionDigits: 2 })} (${fmtPct(ix.percChange as number)}). `;
      if (mv) {
        const g = rowsOf((mv as Raw).gainers).slice(0, 3).map((r) => String(r.symbol)).join(", ");
        const l = rowsOf((mv as Raw).losers).slice(0, 3).map((r) => String(r.symbol)).join(", ");
        if (g) s += `Top gainers include ${g}. `;
        if (l) s += `Top losers include ${l}.`;
      }
      return s || "Market overview is unavailable right now.";
    }
  }
}

const TIMELINE = [
  "Understanding query",
  "Selecting NSE data",
  "Retrieving market data",
  "Analyzing",
  "Generating response",
];

export async function POST(req: NextRequest) {
  try {
    const { question } = (await req.json()) as { question?: string };
    const q = (question ?? "").trim().slice(0, 500);
    if (!q) return ok({ error: "Ask a question about the Indian market." }, { status: 400 });

    const plan = planAsk(q);
    const exec = await execute(plan);

    const sources = exec.map((e) => ({
      server: e.spec.server === "cm" ? "NSE CM MCP (live)" : "NSE bhavcopy MCP (history)",
      tool: e.spec.tool,
      params: resolvePlaceholders(e.spec.args),
      label: e.spec.label,
      ok: !e.error,
    }));

    let answer = compose(plan, exec);

    // Optional LLM prose polish — strictly grounded in the retrieved facts.
    const facts = JSON.stringify({
      intent: plan.intent,
      summary: plan.summary,
      answer,
      sources: sources.map((s) => ({ tool: s.tool, params: s.params })),
    }).slice(0, 6000);
    const polished = await llmPolish(q, facts);
    if (polished) answer = polished;

    return ok(
      envelope({
        question: q,
        intent: plan.intent,
        answer,
        sources,
        timeline: TIMELINE,
        llmUsed: polished != null,
      }),
    );
  } catch (err) {
    return apiError(err);
  }
}
