import { NextRequest } from "next/server";
import { getIndexHistory } from "@/lib/nse";
import { apiError, envelope, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name")?.trim();
    if (!name) return ok({ error: "Missing ?name= parameter." }, { status: 400 });
    const months = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("months") ?? "12", 10) || 12, 1), 60);
    const { bars } = await getIndexHistory(name, months);
    return ok(envelope({ name, bars }));
  } catch (err) {
    return apiError(err);
  }
}
