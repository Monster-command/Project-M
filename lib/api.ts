/** Shared helpers for API route handlers. */
import { NextResponse } from "next/server";
import { McpError } from "./mcp";
import { NotFoundError } from "./nse";
import { isMarketOpen } from "./market";

export function ok<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

export function apiError(err: unknown): NextResponse {
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof McpError) {
    if (err.code === "timeout" || err.code === "unreachable") {
      return NextResponse.json(
        { error: "NSE market data could not be retrieved right now." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Market data is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
  console.error("[api]", err);
  return NextResponse.json(
    { error: "Market data is temporarily unavailable. Please try again." },
    { status: 500 },
  );
}

/** Freshness envelope every route returns. */
export function envelope<T>(data: T, asOf?: string | null) {
  const open = isMarketOpen();
  return {
    ...data,
    marketOpen: open,
    // Outside 09:15–15:30 IST Mon–Fri every figure is the last close.
    stale: !open,
    asOf: asOf ?? new Date().toISOString(),
  };
}

/** Run async fns over arr with at most `limit` in flight. */
export async function mapLimit<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
    while (next < arr.length) {
      const i = next++;
      results[i] = await fn(arr[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
