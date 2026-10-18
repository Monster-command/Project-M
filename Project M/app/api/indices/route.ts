import { getIndexHistory, getIndexQuote, NotFoundError } from "@/lib/nse";
import { apiError, envelope, mapLimit, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

// Exact NSE names (verified against cm_get_index_quote).
const CARDS = [
  "NIFTY 50",
  "NIFTY BANK",
  "NIFTY IT",
  "NIFTY FIN SERVICE",
  "NIFTY MIDCAP 100",
];

const DISPLAY_NAMES: Record<string, string> = {
  "NIFTY FIN SERVICE": "NIFTY Financial Services",
};

export async function GET() {
  try {
    const indices = (
      await mapLimit(CARDS, 3, async (name) => {
        try {
          const [quote, hist] = await Promise.all([
            getIndexQuote(name),
            // getIndexHistory maps CM names to bhavcopy names internally.
            getIndexHistory(name, 1).catch(() => ({ bars: [] })),
          ]);
          return {
            ...quote,
            name: DISPLAY_NAMES[name] ?? quote.name,
            spark: hist.bars.map((b) => b.close),
            sparkDates: hist.bars.map((b) => b.date),
          };
        } catch (err) {
          // One bad index must not take down the whole dashboard.
          if (err instanceof NotFoundError) return null;
          throw err;
        }
      })
    ).filter((x): x is NonNullable<typeof x> => x !== null);
    if (indices.length === 0) {
      return ok({ error: "NSE market data could not be retrieved right now." }, { status: 503 });
    }
    return ok(envelope({ indices }, new Date().toISOString()));
  } catch (err) {
    return apiError(err);
  }
}
