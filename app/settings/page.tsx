"use client";
import { useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { cx } from "@/lib/format";

export default function Settings() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const set = (t: "dark" | "light") => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("nsei-theme", t);
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card className="mt-5 p-5">
        <SectionTitle title="Appearance" />
        <div className="flex gap-2" role="group" aria-label="Theme">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => set(t)}
              aria-pressed={theme === t}
              className={cx(
                "focus-ring rounded-lg border px-4 py-2 text-sm font-medium capitalize",
                theme === t
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--faint)]">Dark is the default. Your choice is saved in this browser.</p>
      </Card>
      <Card className="mt-4 p-5">
        <SectionTitle title="About this data" />
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          Project M reads live market data from NSE&apos;s official MCP servers — never scraped,
          never invented. Watchlists and saved screens are stored only in your browser&apos;s local storage.
          See the <a href="/data-source" className="text-[var(--accent)] hover:underline">Data Source</a> page
          for provenance and the SEBI disclaimer.
        </p>
      </Card>
    </div>
  );
}
