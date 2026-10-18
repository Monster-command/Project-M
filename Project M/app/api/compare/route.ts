import { NextRequest } from "next/server";
import { compareStocks, getStockHistory } from "@/lib/nse";
import { apiError, envelope, mapLimit, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CompareBody {
  symbols?: string[];
  months?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CompareBody;
    const symbols = [...new Set((body.symbols ?? []).map((s) => s.toUpperCase().trim()).filter(Boolean))];
    if (symbols.length < 2) {
      return ok({ error: "Provide 2–5 symbols to compare." }, { status: 400 });
    }
    if (symbols.length > 10) {
      return ok({ error: "Compare supports at most 10 symbols." }, { status: 400 });
    }
    const months = Math.min(Math.max(Math.round(body.months ?? 12), 1), 60);
    // Normalized paths need daily bars; cap chart history at 12 months for speed.
    const chartMonths = Math.min(months, 12);
    const [{ results, warnings }, series] = await Promise.all([
      compareStocks(symbols, months),
      mapLimit(symbols, 4, async (sym) => {
        try {
          const { bars } = await getStockHistory(sym, chartMonths);
          const base = bars[0].close;
          return {
            symbol: sym,
            points: bars.map((b) => ({ date: b.date, value: (b.close / base) * 100 })),
          };
        } catch {
          return { symbol: sym, points: [] as Array<{ date: string; value: number }> };
        }
      }),
    ]);
    return ok(envelope({ symbols, months, results, warnings, series }));
  } catch (err) {
    return apiError(err);
  }
}
