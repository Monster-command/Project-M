/**
 * Typed wrappers over the two NSE MCP servers, normalizing responses into
 * the app's internal data model. Every figure returned here comes straight
 * from an MCP tool response — nothing is synthesized.
 */
import { bhavClient, cmClient, McpError } from "./mcp";
import { cached, TTL } from "./cache";

/* ---------------------------------- types --------------------------------- */

export interface StockQuote {
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

export interface IndexQuote {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  week52High: number | null;
  week52Low: number | null;
  timestamp: string | null;
  comparisons: {
    oneWeekAgoPct: number | null;
    oneMonthAgoPct: number | null;
    oneYearAgoPct: number | null;
  };
}

export interface OhlcvBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Mover {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
}

export interface Breadth {
  advances: number;
  declines: number;
  unchanged: number;
  adRatio: number | null;
  totalVolume: number | null;
}

export interface CorporateActionEvent {
  type: string;
  exDate: string;
  detail: string;
}

export interface CorporateActionCheck {
  events: CorporateActionEvent[];
  hasSplitOrBonus: boolean;
  lookupFailed: boolean;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/* --------------------------------- helpers -------------------------------- */

type Raw = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Normalize "no such symbol" style tool errors into NotFoundError. */
function rethrowNotFound(err: unknown, symbol: string): never {
  if (err instanceof McpError) {
    const m = err.message.toLowerCase();
    // Conservative: only map clear not-found phrasing.
    if (m.includes("not found") || m.includes("invalid symbol") || m.includes("no data")) {
      throw new NotFoundError(`${symbol} was not found on NSE.`);
    }
  }
  throw err;
}

/* ------------------------------ live (CM server) --------------------------- */

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const sym = symbol.trim().toUpperCase();
  try {
    return await cached(`quote:${sym}`, TTL.live, async () => {
      const raw = (await cmClient.callTool("cm_get_stock_quote", { symbol: sym })) as Raw;
      const s = (raw.stock ?? raw) as Raw;
      const price = num(s.lastTradedPrice ?? s.ltp);
      if (price == null) throw new NotFoundError(`${sym} was not found on NSE.`);
      return {
        symbol: str(s.symbol) ?? sym,
        price,
        change: num(s.change) ?? 0,
        changePercent: num(s.perChange ?? s.perchange) ?? 0,
        volume: num(s.volume) ?? 0,
        open: num(s.openPrice) ?? 0,
        high: num(s.highPrice) ?? 0,
        low: num(s.lowPrice) ?? 0,
        prevClose: num(s.preClosePrice) ?? 0,
        week52High: num(s.fiftyTwoWeekHigh),
        week52Low: num(s.fiftyTwoWeekLow),
        perChange30d: num(s.perChange30d),
        timestamp: str(s.latestTimestamp),
      };
    });
  } catch (err) {
    rethrowNotFound(err, sym);
  }
}

export async function getIndexQuote(name: string): Promise<IndexQuote> {
  return cached(`index:${name.toUpperCase()}`, TTL.live, async () => {
    const raw = (await cmClient.callTool("cm_get_index_quote", { indexName: name })) as Raw;
    const idx = (raw.index ?? raw) as Raw;
    const value = num(idx.last);
    if (value == null) throw new NotFoundError(`${name} index was not found.`);
    const comp = (idx.comparisons ?? {}) as Raw;
    const pct = (k: string) => {
      const c = comp[k] as Raw | undefined;
      return c ? num(c.changePct) : null;
    };
    return {
      name: str(idx.indexName) ?? name,
      value,
      change: num(idx.change) ?? 0,
      changePercent: num(idx.percChange) ?? 0,
      open: num(idx.open),
      high: num(idx.high),
      low: num(idx.low),
      prevClose: num(idx.previousClose),
      week52High: num(idx.yearHigh),
      week52Low: num(idx.yearLow),
      timestamp: str(idx.timeVal) ?? str(raw.nseTimestamp),
      comparisons: {
        oneWeekAgoPct: pct("oneWeekAgo"),
        oneMonthAgoPct: pct("oneMonthAgo"),
        oneYearAgoPct: pct("oneYearAgo"),
      },
    };
  });
}

export async function getMarketMovers(
  limit: number,
  indexName?: string,
): Promise<{ gainers: Mover[]; losers: Mover[]; asOf: string | null }> {
  const key = `movers:${indexName ?? "all"}:${limit}`;
  return cached(key, TTL.live, async () => {
    const raw = (await cmClient.callTool("nse_get_market_movers", {
      indexName: indexName ?? null,
      limit,
    })) as Raw;
    const map = (rows: unknown): Mover[] =>
      (Array.isArray(rows) ? rows : []).map((r) => {
        const x = r as Raw;
        return {
          symbol: str(x.symbol) ?? "",
          price: num(x.ltp) ?? 0,
          changePercent: num(x.perChange) ?? 0,
          volume: num(x.trade_quantity) ?? 0,
        };
      });
    return {
      gainers: map(raw.gainers),
      losers: map(raw.losers),
      asOf: str(raw.gainersUpdatedAt) ?? str(raw.updatedAt),
    };
  });
}

export async function getTopByVolume(
  date: string,
  n: number,
): Promise<{ rows: Mover[]; asOf: string | null }> {
  return cached(`topvol:${date}:${n}`, TTL.eod, async () => {
    const raw = (await bhavClient.callTool("get_top_by_volume", {
      date,
      n,
      sortBy: "volume",
    })) as Raw;
    const rows = (raw.stocks ?? raw.data ?? []) as Raw[];
    return {
      rows: rows.map((x) => ({
        symbol: str(x.symbol) ?? "",
        price: num(x.close ?? x.ltp) ?? 0,
        changePercent: num(x.perChange ?? x.change_pct) ?? 0,
        volume: num(x.volume ?? x.trade_quantity) ?? 0,
      })),
      asOf: str(raw.date) ?? date,
    };
  });
}

/* --------------------------- history (bhavcopy) ---------------------------- */

export async function getCorporateActions(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<CorporateActionCheck> {
  const sym = symbol.toUpperCase();
  return cached(`ca:${sym}:${fromDate}:${toDate}`, TTL.eod, async () => {
    try {
      const raw = (await bhavClient.callTool("get_corporate_actions", {
        symbol: sym,
        fromDate,
        toDate,
      })) as Raw;
      if (raw.error) return { events: [], hasSplitOrBonus: false, lookupFailed: true };
      const list = (raw.events ?? raw.actions ?? raw.data ?? []) as Raw[];
      const events: CorporateActionEvent[] = list.map((e) => ({
        type: str(e.type ?? e.action ?? e.eventType) ?? "corporate action",
        exDate: str(e.exDate ?? e.ex_date ?? e.date) ?? "",
        detail: str(e.detail ?? e.description ?? e.ratio) ?? "",
      }));
      const hasSplitOrBonus = events.some((e) =>
        /split|bonus/i.test(`${e.type} ${e.detail}`),
      );
      return { events, hasSplitOrBonus, lookupFailed: false };
    } catch {
      return { events: [], hasSplitOrBonus: false, lookupFailed: true };
    }
  });
}

interface HistoryPage extends Raw {
  data?: Raw[];
  next_end_date?: string;
  summary?: Raw;
}

export async function getStockHistory(
  symbol: string,
  months: number,
  endDate?: string,
): Promise<{ bars: OhlcvBar[]; fromDate: string | null; toDate: string | null }> {
  const sym = symbol.toUpperCase();
  const total = Math.min(Math.max(1, Math.round(months)), 60);
  return cached(`hist:${sym}:${total}:${endDate ?? "latest"}`, TTL.eod, async () => {
    let remaining = total;
    let cursor: string | undefined = endDate;
    const pages: Raw[][] = [];
    let fromDate: string | null = null;
    let toDate: string | null = null;
    // Safety bound: 3 months per call -> at most 21 iterations for 60 months.
    for (let i = 0; i < 25 && remaining > 0; i++) {
      const chunk = Math.min(3, remaining);
      const args: Record<string, unknown> = { symbol: sym, months: chunk };
      if (cursor) args.endDate = cursor;
      let page: HistoryPage;
      try {
        page = (await bhavClient.callTool("get_stock_history", args)) as HistoryPage;
      } catch (err) {
        rethrowNotFound(err, sym);
      }
      const rows = page.data ?? [];
      if (rows.length === 0) break;
      pages.unshift(rows);
      fromDate = str((page as Raw).from_date) ?? fromDate;
      toDate = str((page as Raw).to_date) ?? toDate;
      remaining -= chunk;
      const next = str(page.next_end_date);
      if (!next) break;
      cursor = next;
    }
    const seen = new Set<string>();
    const bars: OhlcvBar[] = [];
    for (const rows of pages) {
      for (const r of rows) {
        const date = str(r.date);
        const close = num(r.close);
        if (!date || close == null || seen.has(date)) continue;
        seen.add(date);
        bars.push({
          date,
          open: num(r.open) ?? close,
          high: num(r.high) ?? close,
          low: num(r.low) ?? close,
          close,
          volume: num(r.volume) ?? 0,
        });
      }
    }
    bars.sort((a, b) => (a.date < b.date ? -1 : 1));
    if (bars.length === 0) throw new NotFoundError(`${sym} has no price history on NSE.`);
    return { bars, fromDate, toDate };
  });
}

/** Bhavcopy (history) server uses different names than the CM (live) server. */
const BHAV_INDEX_NAMES: Record<string, string> = {
  "NIFTY FIN SERVICE": "Nifty Financial Services",
};

export async function getIndexHistory(
  name: string,
  months: number,
  endDate?: string,
): Promise<{ bars: OhlcvBar[] }> {
  const bhavName = BHAV_INDEX_NAMES[name.toUpperCase()] ?? name;
  const total = Math.min(Math.max(1, Math.round(months)), 60);
  return cached(`ihist:${bhavName.toUpperCase()}:${total}:${endDate ?? "latest"}`, TTL.eod, async () => {
    let remaining = total;
    let cursor: string | undefined = endDate;
    const pages: Raw[][] = [];
    for (let i = 0; i < 8 && remaining > 0; i++) {
      const chunk = Math.min(12, remaining);
      const args: Record<string, unknown> = { indexName: bhavName, months: chunk };
      if (cursor) args.endDate = cursor;
      const page = (await bhavClient.callTool("get_index_history", args)) as HistoryPage;
      const rows = page.data ?? [];
      if (rows.length === 0) break;
      pages.unshift(rows);
      remaining -= chunk;
      const next = str(page.next_end_date);
      if (!next) break;
      cursor = next;
    }
    const seen = new Set<string>();
    const bars: OhlcvBar[] = [];
    for (const rows of pages)
      for (const r of rows) {
        const date = str(r.date);
        const close = num(r.close);
        if (!date || close == null || seen.has(date)) continue;
        seen.add(date);
        bars.push({
          date,
          open: num(r.open) ?? close,
          high: num(r.high) ?? close,
          low: num(r.low) ?? close,
          close,
          volume: num(r.volume) ?? 0,
        });
      }
    bars.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { bars };
  });
}

export async function get52w(symbol: string) {
  const sym = symbol.toUpperCase();
  return cached(`w52:${sym}`, TTL.eod, async () => {
    const raw = (await bhavClient.callTool("get_52_week_high_low", { symbol: sym })) as Raw;
    const d = (raw.data ?? raw) as Raw;
    return {
      high: num(d["52w_high"] ?? d.high52 ?? d.high_52 ?? d.week52High),
      low: num(d["52w_low"] ?? d.low52 ?? d.low_52 ?? d.week52Low),
      highDate: str(d["52w_high_date"] ?? d.highDate ?? d.high_date),
      lowDate: str(d["52w_low_date"] ?? d.lowDate ?? d.low_date),
      currentPrice: num(d.last_close ?? d.currentPrice ?? d.current_price ?? d.ltp),
      positionPct: num(d.position_in_range_pct ?? d.position_pct ?? d.positionPct),
    };
  });
}

export async function getMarketBreadth(date: string): Promise<Breadth> {
  return cached(`breadth:${date}`, TTL.eod, async () => {
    const raw = (await bhavClient.callTool("get_market_breadth", { date })) as Raw;
    const d = (raw.data ?? raw) as Raw;
    return {
      advances: num(d.advances) ?? 0,
      declines: num(d.declines) ?? 0,
      unchanged: num(d.unchanged) ?? 0,
      adRatio: num(d.adRatio ?? d.ad_ratio),
      totalVolume: num(d.totalVolume ?? d.total_volume),
    };
  });
}

export async function getBulkQuotes(symbols: string[]) {
  const syms = symbols.map((s) => s.toUpperCase());
  return cached(`bulk:${syms.join(",")}`, TTL.live, async () => {
    const raw = (await bhavClient.callTool("get_bulk_quote", { symbols: syms })) as Raw;
    const rows = (raw.quotes ?? raw.data ?? raw.stocks ?? []) as Raw[];
    return rows.map((x) => ({
      symbol: str(x.symbol) ?? "",
      price: num(x.close ?? x.ltp) ?? 0,
      changePercent: num(x.pct_change ?? x.perChange ?? x.change_pct) ?? 0,
      change:
        num(x.change) ??
        (num(x.close) != null && num(x.prev_close ?? x.prevClose) != null
          ? (num(x.close) as number) - (num(x.prev_close ?? x.prevClose) as number)
          : 0),
      volume: num(x.volume) ?? 0,
      open: num(x.open),
      high: num(x.high),
      low: num(x.low),
      prevClose: num(x.prev_close ?? x.prevClose),
      date: str(x.date),
    }));
  });
}

export async function searchSymbols(query: string) {
  const q = query.trim();
  if (!q) return [];
  return cached(`search:${q.toLowerCase()}`, TTL.search, async () => {
    const [tickers, named] = await Promise.all([
      bhavClient.callTool("nse_lookup_symbol", { query: q }).catch(() => null),
      bhavClient.callTool("search_symbols", { query: q }).catch(() => null),
    ]);
    const out = new Map<string, { symbol: string; name?: string; price?: number }>();
    const t = (tickers as Raw | null);
    const tlist = t ? ((t.symbols ?? t.tickers ?? t.data ?? t) as unknown) : null;
    if (Array.isArray(tlist)) {
      for (const s of tlist.slice(0, 12)) {
        const sym = typeof s === "string" ? s : str((s as Raw).symbol);
        if (sym) out.set(sym, { symbol: sym });
      }
    }
    const n = (named as Raw | null);
    const nlist = n ? ((n.results ?? n.symbols ?? n.data ?? []) as Raw[]) : [];
    for (const r of nlist.slice(0, 12)) {
      const sym = str(r.symbol);
      if (!sym) continue;
      out.set(sym, {
        symbol: sym,
        name: str(r.companyName ?? r.name) ?? undefined,
        // search_symbols rows: {symbol, last_close, pct_change, last_date}
        price: num(r.last_close ?? r.close ?? r.ltp) ?? undefined,
      });
    }
    return [...out.values()].slice(0, 12);
  });
}

export interface CompareResult {
  symbol: string;
  returnPct: number | null;
  maxDrawdownPct: number | null;
  corporateActionsApplied: string[];
}

export async function compareStocks(
  symbols: string[],
  months: number,
): Promise<{ results: CompareResult[]; warnings: string[] }> {
  const syms = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(0, 10);
  const key = `cmp:${syms.join(",")}:${months}`;
  return cached(key, TTL.eod, async () => {
    const raw = (await bhavClient.callTool("compare_stocks", {
      symbols: syms,
      months,
    })) as Raw;
    const rows = (raw.results ?? raw.comparison ?? raw.data ?? raw.stocks ?? []) as Raw[];
    const results: CompareResult[] = rows.map((r) => ({
      symbol: str(r.symbol) ?? "",
      returnPct: num(r.return_pct ?? r.returnPct),
      maxDrawdownPct: num(r.max_drawdown_pct ?? r.maxDrawdownPct ?? r.max_drawdown),
      corporateActionsApplied: Array.isArray(r.corporate_actions_applied)
        ? (r.corporate_actions_applied as string[])
        : [],
    }));
    const warnings: string[] = [];
    // Corporate-action safety: flag any split/bonus inside the window.
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const f = (d: Date) => d.toISOString().slice(0, 10);
    await Promise.all(
      syms.map(async (s) => {
        const check = await getCorporateActions(s, f(from), f(to));
        if (check.hasSplitOrBonus)
          warnings.push(`${s}: split/bonus in period — return figures are unadjusted`);
        else if (check.lookupFailed)
          warnings.push(`${s}: corporate-action check unavailable — treat returns with care`);
      }),
    );
    return { results, warnings };
  });
}

export async function getStockVsIndex(symbol: string, indexName: string, months: number) {
  const key = `svi:${symbol.toUpperCase()}:${indexName.toUpperCase()}:${months}`;
  return cached(key, TTL.eod, async () => {
    const raw = (await bhavClient.callTool("get_stock_vs_index", {
      symbol: symbol.toUpperCase(),
      indexName,
      months,
    })) as Raw;
    const d = (raw.data ?? raw) as Raw;
    return {
      stockReturnPct: num(d.stock_return_pct ?? d.stockReturnPct),
      indexReturnPct: num(d.index_return_pct ?? d.indexReturnPct),
      outperformancePp: num(d.outperformance_pp ?? d.outperformancePp),
      beta: num(d.beta),
      correlation: num(d.correlation),
      corporateActionsApplied: Array.isArray(d.corporate_actions_applied)
        ? (d.corporate_actions_applied as string[])
        : [],
    };
  });
}

export async function getIndexPerformance(name: string) {
  return cached(`iperf:${name.toUpperCase()}`, TTL.eod, async () => {
    const raw = (await bhavClient.callTool("get_index_performance", {
      indexName: name,
    })) as Raw;
    return raw as Raw;
  });
}
