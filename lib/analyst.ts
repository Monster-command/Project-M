/**
 * Deterministic intent router for the AI analyst (/api/ask).
 *
 * The router maps a natural-language question to NSE MCP tool calls, the
 * route executes them, and the answer is composed ONLY from the retrieved
 * values. No number in an answer may come from anywhere else.
 *
 * Optional LLM polish: if LLM_API_KEY is set (OpenAI-compatible endpoint via
 * LLM_BASE_URL / LLM_MODEL), the retrieved facts are sent to the model with a
 * strict grounding system prompt. The model never sees the raw question alone
 * and may not introduce new figures.
 */

export interface ToolCallSpec {
  server: "cm" | "bhavcopy";
  tool: string;
  args: Record<string, unknown>;
  label: string;
}

export interface AskPlan {
  intent:
    | "movers"
    | "quote"
    | "history"
    | "compare"
    | "breadth"
    | "index"
    | "search"
    | "overview";
  specs: ToolCallSpec[];
  symbols: string[];
  summary: string;
}

/**
 * Common company-name -> NSE symbol mappings, applied before token extraction
 * so natural phrasing ("Infosys", "HDFC Bank") resolves to real symbols.
 */
const COMPANY_TO_SYMBOL: Array<[RegExp, string]> = [
  [/infosys/i, "INFY"],
  [/tata\s*motors/i, "TATAMOTORS"],
  [/tata\s*steel/i, "TATASTEEL"],
  [/\btcs\b/i, "TCS"],
  [/tech\s*mahindra/i, "TECHM"],
  [/hcl\s*tech/i, "HCLTECH"],
  [/hdfc\s*bank/i, "HDFCBANK"],
  [/\bhdfc\b/i, "HDFCBANK"],
  [/icici\s*bank/i, "ICICIBANK"],
  [/axis\s*bank/i, "AXISBANK"],
  [/kotak\s*(mahindra)?/i, "KOTAKBANK"],
  [/state\s*bank/i, "SBIN"],
  [/\bsbi\b/i, "SBIN"],
  [/bajaj\s*finance/i, "BAJFINANCE"],
  [/asian\s*paints/i, "ASIANPAINT"],
  [/sun\s*pharma/i, "SUNPHARMA"],
  [/ultra\s*tech/i, "ULTRACEMCO"],
  [/\bmaruti\b/i, "MARUTI"],
  [/\btitan\b/i, "TITAN"],
  [/\bnestle\b/i, "NESTLEIND"],
  [/\breliance\b/i, "RELIANCE"],
  [/\bwipro\b/i, "WIPRO"],
  [/larsen(?:\s*&?\s*toubro)?/i, "LT"],
  [/\bongc\b/i, "ONGC"],
  [/coal\s*india/i, "COALINDIA"],
  [/tata\s*power/i, "TATAPOWER"],
  [/tata\s*consumer/i, "TATACONSUM"],
  [/britannia/i, "BRITANNIA"],
  [/eicher\s*motors/i, "EICHERMOT"],
  [/hero\s*motocorp/i, "HEROMOTOCO"],
  [/grasim/i, "GRASIM"],
  [/hindalco/i, "HINDALCO"],
  [/dr\s*reddy/i, "DRREDDY"],
  [/ci pla/i, "CIPLA"],
  [/divis/i, "DIVISLAB"],
];

const SYMBOL_RE = /\b[A-Z][A-Z0-9&.-]{1,14}\b/g;
const STOPWORDS = new Set([
  "WHAT", "WHEN", "WHICH", "TODAY", "SHOW", "COMPARE", "OVER", "LAST", "YEAR",
  "NEAR", "HIGH", "HIGHS", "MOST", "BEST", "THE", "AND", "WITH", "ARE",
  "STOCKS", "STOCK", "GAINED", "GAINERS", "LOSERS", "ACTIVE", "ACTIVELY",
  "TRADED", "BREADTH", "MARKET", "INDIAN", "NSE", "HAPPENED", "GIVE", "TELL",
]);

function extractSymbols(q: string): string[] {
  // Normalize common company names to NSE symbols BEFORE token extraction,
  // so "Infosys" -> INFY instead of the invalid token "INFOSYS".
  let norm = q;
  for (const [re, sym] of COMPANY_TO_SYMBOL) norm = norm.replace(re, ` ${sym} `);
  const upper = norm.toUpperCase();
  const out: string[] = [];
  for (const m of upper.match(SYMBOL_RE) ?? []) {
    const clean = m.replace(/[.&-]+$/, "");
    if (!STOPWORDS.has(clean) && !out.includes(clean) && clean.length >= 2) out.push(clean);
  }
  return out.slice(0, 5);
}

const INDEX_ALIASES: Array<{ match: RegExp; name: string }> = [
  { match: /nifty\s*bank/i, name: "NIFTY BANK" },
  { match: /nifty\s*it\b/i, name: "NIFTY IT" },
  { match: /financial\s*services|fin\s*service/i, name: "NIFTY FIN SERVICE" },
  { match: /midcap\s*100/i, name: "NIFTY MIDCAP 100" },
  { match: /nifty\s*50/i, name: "NIFTY 50" },
  { match: /india\s*vix|vix/i, name: "INDIA VIX" },
];

function detectIndex(q: string): string | null {
  for (const a of INDEX_ALIASES) if (a.match.test(q)) return a.name;
  return null;
}

export function planAsk(question: string): AskPlan {
  const q = question.trim();
  const lower = q.toLowerCase();
  const symbols = extractSymbols(q);
  const indexName = detectIndex(q);

  const has = (...words: string[]) => words.some((w) => lower.includes(w));

  // 1. Movers
  if (has("gainer", "top gain", "biggest gain", "loser", "top los", "biggest los", "movers")) {
    return {
      intent: "movers",
      specs: [
        {
          server: "cm",
          tool: "nse_get_market_movers",
          args: { indexName: null, limit: 10 },
          label: "Top gainers & losers (NSE CM MCP)",
        },
      ],
      symbols: [],
      summary: "today's top gainers and losers",
    };
  }
  // 2. Breadth
  if (has("breadth", "advance", "decline", "advances", "declines")) {
    return {
      intent: "breadth",
      specs: [
        {
          server: "bhavcopy",
          tool: "get_market_breadth",
          args: { date: "__LAST_TRADING_DAY__" },
          label: "Market breadth (NSE bhavcopy MCP)",
        },
        {
          server: "bhavcopy",
          tool: "get_market_mood",
          args: { date: "__LAST_TRADING_DAY__" },
          label: "Market mood incl. India VIX (NSE bhavcopy MCP)",
        },
      ],
      symbols: [],
      summary: "market breadth and mood",
    };
  }
  // 3. Compare (2+ symbols + compare intent)
  if (symbols.length >= 2 && has("compar", " vs ", "versus")) {
    return {
      intent: "compare",
      specs: [
        {
          server: "bhavcopy",
          tool: "compare_stocks",
          args: { symbols, months: 12 },
          label: "12-month stock comparison (NSE bhavcopy MCP)",
        },
      ],
      symbols,
      summary: `${symbols.join(" vs ")} over 12 months`,
    };
  }
  // 4. History / performance of one symbol
  if (symbols.length >= 1 && has("history", "histor", "performance", "return", "chart", "year", "month", "trend")) {
    const sym = symbols[0];
    return {
      intent: "history",
      specs: [
        {
          server: "bhavcopy",
          tool: "get_stock_history",
          args: { symbol: sym, months: 12 },
          label: `12-month OHLCV history for ${sym} (NSE bhavcopy MCP)`,
        },
        {
          server: "bhavcopy",
          tool: "get_corporate_actions",
          args: { symbol: sym, fromDate: "__YEAR_AGO__", toDate: "__TODAY__" },
          label: `Corporate actions for ${sym} (NSE bhavcopy MCP)`,
        },
      ],
      symbols: [sym],
      summary: `${sym} 12-month history`,
    };
  }
  // 5. Index quote
  if (indexName) {
    return {
      intent: "index",
      specs: [
        {
          server: "cm",
          tool: "cm_get_index_quote",
          args: { indexName },
          label: `${indexName} quote (NSE CM MCP)`,
        },
      ],
      symbols: [],
      summary: indexName,
    };
  }
  // 6. Single-symbol quote / 52-week / volume questions
  if (symbols.length >= 1) {
    const sym = symbols[0];
    const specs: ToolCallSpec[] = [
      {
        server: "cm",
        tool: "cm_get_stock_quote",
        args: { symbol: sym },
        label: `${sym} live quote (NSE CM MCP)`,
      },
    ];
    if (has("52", "week high", "week low", "high low")) {
      specs.push({
        server: "bhavcopy",
        tool: "get_52_week_high_low",
        args: { symbol: sym },
        label: `${sym} 52-week range (NSE bhavcopy MCP)`,
      });
    }
    if (has("volume", "traded")) {
      specs.push({
        server: "bhavcopy",
        tool: "get_volume_analysis",
        args: { symbol: sym, days: 20 },
        label: `${sym} volume analysis (NSE bhavcopy MCP)`,
      });
    }
    return { intent: "quote", specs, symbols: [sym], summary: `${sym} quote` };
  }
  // 7. Symbol search ("what is the symbol for ...", unknown token)
  if (has("symbol for", "ticker for", "find ", "search")) {
    return {
      intent: "search",
      specs: [
        {
          server: "bhavcopy",
          tool: "search_symbols",
          args: { query: q.slice(0, 60) },
          label: "Symbol search (NSE bhavcopy MCP)",
        },
      ],
      symbols: [],
      summary: "symbol search",
    };
  }
  // 8. Fallback: market overview
  return {
    intent: "overview",
    specs: [
      {
        server: "cm",
        tool: "nse_get_market_movers",
        args: { indexName: null, limit: 5 },
        label: "Top movers (NSE CM MCP)",
      },
      {
        server: "cm",
        tool: "cm_get_index_quote",
        args: { indexName: "NIFTY 50" },
        label: "NIFTY 50 quote (NSE CM MCP)",
      },
    ],
    symbols: [],
    summary: "market overview",
  };
}

/** Resolve __TODAY__ / __LAST_TRADING_DAY__ / __YEAR_AGO__ placeholders. */
export function resolvePlaceholders(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const lastTrading = new Date(today);
  const day = lastTrading.getUTCDay();
  if (day === 0) lastTrading.setUTCDate(lastTrading.getUTCDate() - 2);
  else if (day === 6) lastTrading.setUTCDate(lastTrading.getUTCDate() - 1);
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  for (const [k, v] of Object.entries(args)) {
    out[k] =
      v === "__TODAY__"
        ? iso(today)
        : v === "__LAST_TRADING_DAY__"
          ? iso(lastTrading)
          : v === "__YEAR_AGO__"
            ? iso(yearAgo)
            : v;
  }
  return out;
}

const LLM_SYSTEM = `You are the prose layer of a market-data assistant. You are given FACTS retrieved live from NSE's official MCP servers plus a question. Rules: use ONLY the numbers in FACTS; never invent, round beyond what is shown, or add figures from training data; if a requested figure is absent, say it is unavailable; keep it concise and neutral; end with no recommendation. Do not give investment advice.`;

export async function llmPolish(question: string, factsJson: string): Promise<string | null> {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 600,
        messages: [
          { role: "system", content: LLM_SYSTEM },
          { role: "user", content: `QUESTION: ${question}\n\nFACTS (JSON):\n${factsJson}` },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
