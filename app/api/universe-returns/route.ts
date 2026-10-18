import { NextRequest } from "next/server";
import { compareStocks } from "@/lib/nse";
import { UNIVERSES } from "@/lib/universe";
import { apiError, envelope, mapLimit, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Ranked N-month returns across the NIFTY 50 universe (for Markets > Returns). */
export async function GET(req: NextRequest) {
  try {
    const months = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("months") ?? "12", 10) || 12, 1), 60);
    const symbols = UNIVERSES.NIFTY50.symbols;
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += 10) chunks.push(symbols.slice(i, i + 10));
    const results = await mapLimit(chunks, 3, (c) =>
      compareStocks(c, months).catch(() => ({ results: [], warnings: [] as string[] })),
    );
    const rows = results
      .flatMap((r) => r.results)
      .filter((r) => r.returnPct != null)
      .sort((a, b) => (b.returnPct as number) - (a.returnPct as number));
    const warnings = [...new Set(results.flatMap((r) => r.warnings))];
    return ok(
      envelope({
        months,
        rows: rows.map((r) => ({
          symbol: r.symbol,
          returnPct: r.returnPct,
          maxDrawdownPct: r.maxDrawdownPct,
        })),
        warnings,
      }),
    );
  } catch (err) {
    return apiError(err);
  }
}
