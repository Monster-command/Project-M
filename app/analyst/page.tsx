"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { postJson } from "@/components/useApi";
import { Card, ErrorState, Skeleton } from "@/components/ui";
import { cx } from "@/lib/format";

interface Source {
  server: string;
  tool: string;
  params: Record<string, unknown>;
  label: string;
  ok: boolean;
}
interface AskResp {
  answer: string;
  sources: Source[];
  timeline: string[];
  intent: string;
  llmUsed: boolean;
  stale: boolean;
}
interface Msg {
  role: "user" | "ai";
  text: string;
  sources?: Source[];
  error?: boolean;
}

const EXAMPLES = [
  "What are today's biggest gainers?",
  "Compare Reliance and TCS over the last year.",
  "Show me the most actively traded stocks.",
  "Which stocks are near their 52-week highs?",
  "How is NIFTY BANK doing?",
];

function AnalystInner() {
  const params = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [openSources, setOpenSources] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setStage(0);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, 4)), 900);
    try {
      const d = await postJson<AskResp>("/api/ask", { question: q });
      setMsgs((m) => [...m, { role: "ai", text: d.answer, sources: d.sources }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: "ai", text: e instanceof Error ? e.message : "NSE market data could not be retrieved right now.", error: true },
      ]);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !askedRef.current) {
      askedRef.current = true;
      ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const TIMELINE = ["Understanding query", "Selecting NSE data", "Retrieving market data", "Analyzing", "Generating response"];

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">AI Analyst</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Answers are built from live NSE MCP data — every figure is traceable. Never investment advice.
      </p>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-4">
        {msgs.length === 0 && !busy && (
          <div>
            <p className="mb-2 text-[12px] uppercase tracking-wider text-[var(--faint)]">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => ask(e)}
                  className="focus-ring rounded-full border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-[13px] text-[var(--muted)] hover:border-[var(--faint)] hover:text-[var(--ink)]"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-ink)]">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <Card className="max-w-[90%] p-4">
                {m.error ? (
                  <p className="text-sm text-[var(--muted)]">{m.text}</p>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-sm leading-relaxed">{m.text}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-t border-[var(--border)] pt-2">
                        <button
                          onClick={() => setOpenSources(openSources === i ? null : i)}
                          className="focus-ring text-[12px] font-medium text-[var(--accent)] hover:underline"
                          aria-expanded={openSources === i}
                        >
                          {openSources === i ? "Hide data sources" : "View data sources"}
                        </button>
                        {openSources === i && (
                          <ul className="mt-2 space-y-1.5">
                            {m.sources.map((s, j) => (
                              <li key={j} className="rounded-lg bg-[var(--panel2)] px-3 py-2 text-[11px] text-[var(--muted)]">
                                <span className={cx("mr-2 font-semibold", s.ok ? "text-[var(--up)]" : "text-[var(--down)]")}>
                                  {s.ok ? "✓" : "✗"}
                                </span>
                                <span className="font-mono text-[var(--ink)]">{s.tool}</span>
                                <span className="ml-2">{s.label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>
          ),
        )}
        {busy && (
          <Card className="max-w-[90%] p-4">
            <ol className="space-y-1.5" aria-live="polite">
              {TIMELINE.map((t, i) => (
                <li key={t} className={cx("flex items-center gap-2 text-[13px]", i <= stage ? "text-[var(--ink)]" : "text-[var(--faint)]")}>
                  <span className={cx("flex h-4 w-4 items-center justify-center rounded-full border text-[9px]", i < stage ? "border-[var(--up)] text-[var(--up)]" : i === stage ? "animate-pulse-soft border-[var(--accent)]" : "border-[var(--border)]")}>
                    {i < stage ? "✓" : ""}
                  </span>
                  {t}
                  {i === stage && <span className="text-[var(--faint)]">…</span>}
                </li>
              ))}
            </ol>
          </Card>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-[var(--border)] pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about the Indian market…"
          className="focus-ring flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none placeholder:text-[var(--faint)]"
          aria-label="Ask the AI analyst"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="focus-ring rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

export default function Analyst() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-6"><Skeleton className="h-64" /></div>}>
      <AnalystInner />
    </Suspense>
  );
}
