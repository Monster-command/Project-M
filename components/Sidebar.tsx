"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/stocks", label: "Stocks" },
  { href: "/compare", label: "Compare" },
  { href: "/analyst", label: "AI Analyst" },
  { href: "/quant", label: "Quant Lab" },
  { href: "/watchlist", label: "Watchlist" },
];

const BOTTOM = [
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About" },
  { href: "/data-source", label: "Data Source" },
];

function Item({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const active = path === href || (href !== "/dashboard" && path.startsWith(href + "/"));
  return (
    <Link
      href={href}
      className={cx(
        "focus-ring block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-[var(--accent-dim)] text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--ink)]",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-[var(--border)] bg-[var(--panel)] p-4 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-1">
        <img src="/logo-light.png" alt="Project M" className="brand-mark h-8 w-8" />
        <span className="text-[15px] font-bold tracking-tight">Project M</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
        {NAV.map((n) => (
          <Item key={n.href} {...n} />
        ))}
      </nav>
      <nav className="flex flex-col gap-0.5 border-t border-[var(--border)] pt-3" aria-label="Secondary">
        {BOTTOM.map((n) => (
          <Item key={n.href} {...n} />
        ))}
      </nav>
    </aside>
  );
}

/** Bottom tab bar for phones. */
export function MobileNav() {
  const path = usePathname();
  const tabs = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/markets", label: "Markets" },
    { href: "/analyst", label: "AI Analyst" },
    { href: "/compare", label: "Compare" },
    { href: "/watchlist", label: "Watchlist" },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--border)] bg-[var(--panel)] md:hidden"
      aria-label="Mobile"
    >
      {tabs.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(
              "flex flex-1 items-center justify-center px-1 py-3 text-[11px] font-medium",
              active ? "text-[var(--accent)]" : "text-[var(--faint)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
