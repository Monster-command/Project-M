import { NextRequest } from "next/server";
import { searchSymbols } from "@/lib/nse";
import { apiError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return ok({ results: [] });
    const results = await searchSymbols(q);
    return ok({ results });
  } catch (err) {
    return apiError(err);
  }
}
