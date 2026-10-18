import { NextRequest } from "next/server";
import { getMarketMovers, getTopByVolume } from "@/lib/nse";
import { lastTradingDateString } from "@/lib/market";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10, 1), 20);
    const [movers, active] = await Promise.all([
      getMarketMovers(limit),
      getTopByVolume(lastTradingDateString(), limit),
    ]);
    return ok(
      envelope(
        { gainers: movers.gainers, losers: movers.losers, mostActive: active.rows },
        movers.asOf,
      ),
    );
  } catch (err) {
    return apiError(err);
  }
}
