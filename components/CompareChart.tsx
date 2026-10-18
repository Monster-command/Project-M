"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { useTheme } from "./useTheme";

export interface NormSeries {
  symbol: string;
  points: Array<{ date: string; value: number }>;
  color: string;
}

/** Base-100 normalized comparison chart. */
export function CompareChart({ series }: { series: NormSeries[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el || series.length === 0) return;
    const dark = theme === "dark";
    const text = dark ? "#a3a3ad" : "#55555e";
    const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: false },
      width: el.clientWidth,
      height: 380,
    });
    for (const s of series) {
      if (s.points.length === 0) continue;
      const line = chart.addLineSeries({
        color: s.color,
        lineWidth: 2,
        title: s.symbol,
        priceFormat: { type: "custom", formatter: (v: number) => v.toFixed(1) } as never,
      });
      line.setData(s.points.map((p) => ({ time: p.date, value: p.value })));
    }
    chart.timeScale().fitContent();
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: w });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [series, theme]);

  return <div ref={ref} className="w-full" aria-label="Normalized comparison chart" />;
}

export const SERIES_COLORS = ["#ffffff", "#c9c9d1", "#8e8e99", "#5c5c66", "#a3a3ad"];
