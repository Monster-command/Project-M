"use client";
import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { CommandPalette } from "@/components/CommandPalette";

/** Wraps page content with the header + global Cmd/Ctrl+K palette. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const open = useCallback(() => setPaletteOpen(true), []);
  const close = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Header onOpenPalette={open} />
      <main className="pb-20 md:pb-10">{children}</main>
      <CommandPalette open={paletteOpen} onClose={close} />
    </>
  );
}
