import { NextRequest } from "next/server";
import { getCorporateActions, getStockHistory } from "@/lib/nse";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
    if (!symbol) return ok({ error: "Missing ?symbol= parameter." }, { status: 400 });
    const months = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("months") ?? "12", 10) || 12, 1), 60);
    const { bars, fromDate, toDate } = await getStockHistory(symbol, months);
    const ca = await getCorporateActions(symbol, bars[0].date, bars[bars.length - 1].date);
    const first = bars[0].close;
    const last = bars[bars.length - 1].close;
    return ok(
      envelope({
        symbol: symbol.toUpperCase(),
        bars,
        fromDate,
        toDate,
        returnPct: ((last - first) / first) * 100,
        corporateActions: ca.events,
        corporateActionWarning: ca.hasSplitOrBonus
          ? "Split/bonus issue in this period — prices are unadjusted NSE bhavcopy data."
          : ca.lookupFailed
            ? "Corporate-action check unavailable for this period."
            : null,
      }),
    );
  } catch (err) {
    return apiError(err);
  }
}
