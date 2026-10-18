import { NextRequest } from "next/server";
import { get52w, getCorporateActions } from "@/lib/nse";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
    if (!symbol) return ok({ error: "Missing ?symbol= parameter." }, { status: 400 });
    const w = await get52w(symbol);
    // Corporate-action check over the trailing year for the 52w range.
    const to = new Date().toISOString().slice(0, 10);
    const fromD = new Date();
    fromD.setFullYear(fromD.getFullYear() - 1);
    const ca = await getCorporateActions(symbol, fromD.toISOString().slice(0, 10), to);
    let positionPct = w.positionPct;
    if (positionPct == null && w.high != null && w.low != null && w.currentPrice != null && w.high !== w.low) {
      positionPct = ((w.currentPrice - w.low) / (w.high - w.low)) * 100;
    }
    return ok(
      envelope({
        symbol: symbol.toUpperCase(),
        high: w.high,
        low: w.low,
        highDate: w.highDate,
        lowDate: w.lowDate,
        currentPrice: w.currentPrice,
        positionPct,
        corporateActionWarning: ca.hasSplitOrBonus
          ? "Split/bonus issue within the 52-week window — the range uses unadjusted prices."
          : null,
      }),
    );
  } catch (err) {
    return apiError(err);
  }
}
