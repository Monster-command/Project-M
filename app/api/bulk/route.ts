import { NextRequest } from "next/server";
import { getBulkQuotes } from "@/lib/nse";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Bulk live-ish quotes for watchlists: /api/bulk?symbols=RELIANCE,TCS */
export async function GET(req: NextRequest) {
  try {
    const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 30);
    if (symbols.length === 0) return ok({ error: "Missing ?symbols= parameter." }, { status: 400 });
    const quotes = await getBulkQuotes(symbols);
    return ok(envelope({ quotes }));
  } catch (err) {
    return apiError(err);
  }
}
