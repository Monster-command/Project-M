"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("nsei-theme");
    setTheme(saved === "light" ? "light" : "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("nsei-theme", next);
  };
  return (
    <button
      onClick={toggle}
      className="focus-ring rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? "☾" : "☀"}
    </button>
  );
}

export function Header({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [status, setStatus] = useState<"open" | "closed" | null>(null);
  useEffect(() => {
    fetch("/api/indices")
      .then((r) => r.json())
      .then((d) => setStatus(d.marketOpen ? "open" : "closed"))
      .catch(() => setStatus(null));
  }, []);
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 md:hidden">
          <img src="/logo-light.png" alt="Project M" className="brand-mark h-7 w-7" />
          <span className="text-sm font-bold">Project M</span>
        </Link>
        <div className="hidden md:block" />
        <button
          onClick={onOpenPalette}
          className="focus-ring mx-auto flex w-full max-w-md items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[13px] text-[var(--faint)] hover:border-[var(--faint)]"
          aria-label="Search (Ctrl+K)"
        >
          <span>Search stocks, indices…</span>
          <kbd className="ml-auto rounded border border-[var(--border)] bg-[var(--panel2)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--muted)]">
            ⌘K
          </kbd>
        </button>
        <span
          className={cx(
            "hidden items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium sm:flex",
            status === "open" ? "text-[var(--up)]" : "text-[var(--muted)]",
          )}
          aria-live="polite"
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", status === "open" ? "bg-[var(--up)]" : "bg-[var(--faint)]")} />
          {status === "open" ? "Market open" : status === "closed" ? "Market closed" : "…"}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
