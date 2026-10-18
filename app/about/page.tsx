import { Card } from "@/components/ui";

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">About</h1>
      <Card className="mt-5 space-y-4 p-6 text-[14px] leading-relaxed text-[var(--muted)]">
        <p>
          <span className="font-semibold text-[var(--ink)]">Project M</span> is an AI-native
          Indian stock market intelligence platform. It combines live NSE market data, historical
          bhavcopy analysis, quantitative screening and a grounded AI analyst in one workspace.
        </p>
        <p>
          Every number on this site comes from NSE&apos;s official MCP servers — the cash-market
          server for live quotes, indices and movers, and the bhavcopy server for five years of
          daily history. The AI analyst only answers from data it has actually retrieved, and shows
          its sources.
        </p>
        <p>
          Built for education and research. Not investment advice — consult a SEBI-registered
          adviser before investing.
        </p>
      </Card>
    </div>
  );
}
