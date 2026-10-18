"use client";
import { cx } from "@/lib/format";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse-soft rounded-md bg-[var(--panel2)]", className)} />;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("card", className)}>{children}</div>;
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--ink)]">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-[var(--faint)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="focus-ring rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--panel2)]"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="card flex flex-col items-center p-8 text-center">
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      {sub && <p className="mt-1 text-xs text-[var(--faint)]">{sub}</p>}
    </div>
  );
}

export function ChangeBadge({ value, suffix = "%" }: { value: number | null | undefined; suffix?: string }) {
  if (value == null) return <span className="tnum text-[var(--faint)]">—</span>;
  const up = value >= 0;
  return (
    <span className={cx("tnum font-medium", up ? "text-[var(--up)]" : "text-[var(--down)]")}>
      {up ? "+" : ""}
      {value.toFixed(2)}{suffix}
    </span>
  );
}

/** "Last updated 10:42:13 AM IST" + stale labeling. */
export function Freshness({ asOf, stale, marketOpen }: { asOf?: string | null; stale?: boolean; marketOpen?: boolean }) {
  return (
    <p className="text-[11px] text-[var(--faint)]">
      {marketOpen === false && <span className="mr-2 rounded bg-[var(--panel2)] px-1.5 py-0.5 font-medium text-[var(--muted)]">Market closed</span>}
      {stale && marketOpen !== false && <span className="mr-2 rounded bg-[var(--panel2)] px-1.5 py-0.5 font-medium text-[var(--muted)]">Last close</span>}
      {asOf ? `Last updated ${asOf}` : "Updating…"}
    </p>
  );
}
