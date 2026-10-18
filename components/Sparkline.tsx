"use client";
import { useMemo } from "react";

/** Minimal SVG sparkline. Green/red by trend; no invented data — pass real closes. */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  strokeWidth = 1.5,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  const { path, up } = useMemo(() => {
    if (values.length < 2) return { path: "", up: true };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = width / (values.length - 1);
    const pts = values.map((v, i) => {
      const x = i * step;
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { path: `M${pts.join(" L")}`, up: values[values.length - 1] >= values[0] };
  }, [values, width, height]);
  if (!path) return <div style={{ width, height }} />;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
