/**
 * Screener universes. Constituent lists are public facts that change over
 * time — the NIFTY 50 list below is indicative as of Oct 2026. The UI labels
 * it as such; prefer the custom-symbols universe for precision.
 */
export const UNIVERSES: Record<string, { label: string; symbols: string[]; note: string }> = {
  NIFTY50: {
    label: "NIFTY 50",
    note: "Indicative constituent list, Oct 2026",
    symbols: [
      "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
      "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BEL", "BHARTIARTL",
      "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY",
      "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE",
      "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK",
      "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT",
      "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC",
      "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SHRIRAMFIN",
      "SUNPHARMA", "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS",
      "TECHM", "TITAN", "TRENT", "ULTRACEMCO", "WIPRO",
    ],
  },
};

export function resolveUniverse(name: string, custom?: string[]): string[] {
  if (name === "CUSTOM" && custom?.length) {
    return [...new Set(custom.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 30);
  }
  return UNIVERSES[name]?.symbols ?? UNIVERSES.NIFTY50.symbols;
}
