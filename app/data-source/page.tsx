import { Card, SectionTitle } from "@/components/ui";

const ROWS: Array<[string, string, string]> = [
  ["Live quotes, indices, gainers/losers", "NSE cash-market MCP server", "Refreshed every 1–5 min during market hours"],
  ["Daily OHLCV history (5Y)", "NSE bhavcopy MCP server", "End-of-day; cached, never changes once published"],
  ["Market breadth & mood", "NSE bhavcopy MCP server", "End-of-day"],
  ["Comparisons, beta, correlation", "NSE bhavcopy MCP server", "Computed from bhavcopy history"],
  ["Symbol search", "NSE bhavcopy MCP server", "Cached 10 min"],
];

export default function DataSource() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Data Source</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Market data is sourced through NSE&apos;s MCP infrastructure.
      </p>

      <Card className="mt-5 p-5">
        <SectionTitle title="What comes from where" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
                <th className="py-2 pr-3 font-medium">Data type</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 font-medium">Freshness</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([a, b, c]) => (
                <tr key={a} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3 font-medium">{a}</td>
                  <td className="py-2 pr-3 text-[var(--muted)]">{b}</td>
                  <td className="py-2 text-[var(--muted)]">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <SectionTitle title="Historical vs near-real-time" />
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--muted)]">
          <li><span className="font-medium text-[var(--ink)]">Near-real-time:</span> quotes, index values, gainers/losers — live only during NSE market hours (Mon–Fri, 09:15–15:30 IST). Outside hours the site shows the last close, clearly labeled.</li>
          <li><span className="font-medium text-[var(--ink)]">Historical:</span> daily open/high/low/close/volume from official NSE bhavcopy files, up to five years. Prices are <span className="font-medium text-[var(--ink)]">unadjusted</span> — splits and bonuses are checked via corporate-action data before any return or comparison is presented.</li>
          <li><span className="font-medium text-[var(--ink)]">No intraday candles:</span> the MCP servers expose snapshots and daily bars only. A &ldquo;1D&rdquo; view reflects the live quote, not intraday bars.</li>
        </ul>
      </Card>

      <Card className="mt-4 border-[var(--down)]/40 p-5">
        <SectionTitle title="Disclaimer" />
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          Data provided through NSE&apos;s MCP servers is for <span className="font-medium text-[var(--ink)]">educational and research purposes only</span>. It does
          not constitute investment advice or a recommendation. NSE is not responsible for AI-generated output.
          Consult a SEBI-registered investment adviser before making investment decisions. Past performance is
          not indicative of future results.
        </p>
      </Card>
    </div>
  );
}
