import { NextRequest } from "next/server";
import { getMarketBreadth } from "@/lib/nse";
import { lastTradingDateString } from "@/lib/market";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date")?.trim() || lastTradingDateString();
    const breadth = await getMarketBreadth(date);
    return ok(envelope({ date, breadth }));
  } catch (err) {
    return apiError(err);
  }
}
