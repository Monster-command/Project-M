import { NextRequest } from "next/server";
import { compareStocks, get52w, getBulkQuotes } from "@/lib/nse";
import { resolveUniverse } from "@/lib/universe";
import { apiError, envelope, mapLimit, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ScreenBody {
  universe?: string;
  symbols?: string[];
  conditions?: {
    minReturnPct?: number;
    returnMonths?: number;
    minVolume?: number;
    maxDist52wHighPct?: number;
    maxDist52wLowPct?: number;
  };
}

interface ScreenRow {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  returnPct: number | null;
  w52High: number | null;
  w52Low: number | null;
  distFrom52wHighPct: number | null;
  distFrom52wLowPct: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ScreenBody;
    const symbols = resolveUniverse(body.universe ?? "NIFTY50", body.symbols);
    if (symbols.length === 0) return ok({ error: "Empty universe." }, { status: 400 });
    const cond = body.conditions ?? {};
    const returnMonths = Math.min(Math.max(Math.round(cond.returnMonths ?? 12), 1), 60);

    // One bulk call for live price/volume, then 52w + returns in parallel.
    const [bulk, w52s, returns] = await Promise.all([
      getBulkQuotes(symbols).catch(() => [] as Awaited<ReturnType<typeof getBulkQuotes>>),
      mapLimit(symbols, 6, (s) => get52w(s).catch(() => null)),
      cond.minReturnPct != null
        ? Promise.all(
            Array.from({ length: Math.ceil(symbols.length / 10) }, (_, i) =>
              compareStocks(symbols.slice(i * 10, i * 10 + 10), returnMonths).catch(() => ({
                results: [] as Array<{ symbol: string; returnPct: number | null }>,
                warnings: [] as string[],
              })),
            ),
          ).then((chunks) => new Map(chunks.flatMap((c) => c.results).map((r) => [r.symbol, r.returnPct])))
        : Promise.resolve(new Map<string, number | null>()),
    ]);

    const bulkBySym = new Map(bulk.map((b) => [b.symbol, b]));
    const warnings: string[] = [];
    const rows: ScreenRow[] = [];

    symbols.forEach((sym, i) => {
      const b = bulkBySym.get(sym);
      const w = w52s[i];
      const price = b?.price ?? w?.currentPrice ?? 0;
      const distFrom52wHighPct =
        w?.high != null && price ? ((w.high - price) / w.high) * 100 : null;
      const distFrom52wLowPct =
        w?.low != null && price && w.low > 0 ? ((price - w.low) / w.low) * 100 : null;
      const returnPct = returns.get(sym) ?? null;
      if (cond.minReturnPct != null && (returnPct == null || returnPct < cond.minReturnPct)) return;
      if (cond.minVolume != null && (b?.volume ?? 0) < cond.minVolume) return;
      if (
        cond.maxDist52wHighPct != null &&
        (distFrom52wHighPct == null || distFrom52wHighPct > cond.maxDist52wHighPct)
      )
        return;
      if (
        cond.maxDist52wLowPct != null &&
        (distFrom52wLowPct == null || distFrom52wLowPct > cond.maxDist52wLowPct)
      )
        return;
      rows.push({
        symbol: sym,
        price,
        changePercent: b?.changePercent ?? 0,
        volume: b?.volume ?? 0,
        returnPct,
        w52High: w?.high ?? null,
        w52Low: w?.low ?? null,
        distFrom52wHighPct,
        distFrom52wLowPct,
      });
    });

    if (cond.minReturnPct != null) {
      warnings.push(
        "Returns use unadjusted NSE bhavcopy prices — check corporate actions before acting.",
      );
    }
    return ok(
      envelope({
        universe: body.universe ?? "NIFTY50",
        scanned: symbols.length,
        matched: rows.length,
        rows,
        warnings,
      }),
    );
  } catch (err) {
    return apiError(err);
  }
}
