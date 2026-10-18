"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import type { OhlcvBar } from "@/lib/nse";
import { useTheme } from "./useTheme";

/** Candlestick + volume chart. Data must be real NSE bhavcopy bars. */
export function StockChart({ bars }: { bars: OhlcvBar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el || bars.length === 0) return;
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
      height: 420,
    });
    const candles = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#f0524f",
      wickUpColor: "#22c55e",
      wickDownColor: "#f0524f",
      borderVisible: false,
    });
    candles.setData(
      bars.map((b) => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close })),
    );
    const vol = chart.addHistogramSeries({
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(
      bars.map((b) => ({
        time: b.date,
        value: b.volume,
        color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(240,82,79,0.45)",
      })),
    );
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
  }, [bars, theme]);

  return <div ref={ref} className="w-full" aria-label="Price chart" />;
}
