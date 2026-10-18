import { NextRequest } from "next/server";
import { getStockQuote, NotFoundError } from "@/lib/nse";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
    if (!symbol) {
      return ok({ error: "Missing ?symbol= parameter." }, { status: 400 });
    }
    const quote = await getStockQuote(symbol);
    return ok(envelope({ quote }, quote.timestamp));
  } catch (err) {
    if (err instanceof NotFoundError) return apiError(err);
    return apiError(err);
  }
}
