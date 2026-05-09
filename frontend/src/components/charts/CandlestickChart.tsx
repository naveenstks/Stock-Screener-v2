"use client";

import { useEffect, useRef } from "react";

interface ChartProps {
  data: {
    candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>;
    ema_lines: {
      ema_9: Array<{ time: string; value: number }>;
      ema_21: Array<{ time: string; value: number }>;
      ema_200: Array<{ time: string; value: number }>;
    };
    rsi_series: Array<{ time: string; value: number }>;
    macd: {
      macd_series: Array<{ time: string; value: number }>;
      signal_series: Array<{ time: string; value: number }>;
      histogram_series: Array<{ time: string; value: number }>;
    };
    bollinger: {
      upper: Array<{ time: string; value: number }>;
      middle: Array<{ time: string; value: number }>;
      lower: Array<{ time: string; value: number }>;
    };
  };
  ticker: string;
}

export function CandlestickChart({ data, ticker }: ChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || !data?.candles?.length) return;

    let LightweightCharts: typeof import("lightweight-charts");

    const init = async () => {
      LightweightCharts = await import("lightweight-charts");

      const chartOpts = {
        layout: { background: { color: "#0e1318" }, textColor: "#5a6880" },
        grid: { vertLines: { color: "#1e2832" }, horzLines: { color: "#1e2832" } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "#1e2832" },
        timeScale: { borderColor: "#1e2832", timeVisible: true },
      };

      // ── Main chart: Candlestick + EMAs + Bollinger ──
      const mainChart = LightweightCharts.createChart(mainRef.current!, {
        ...chartOpts,
        height: 320,
      });

      const candleSeries = mainChart.addCandlestickSeries({
        upColor: "#00e676",
        downColor: "#ff4444",
        borderUpColor: "#00e676",
        borderDownColor: "#ff4444",
        wickUpColor: "#00e676",
        wickDownColor: "#ff4444",
      });
      candleSeries.setData(data.candles);

      // Volume histogram on main chart (scaled)
      const volSeries = mainChart.addHistogramSeries({
        color: "rgba(0,212,255,0.15)",
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      mainChart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volSeries.setData(data.candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "rgba(0,230,118,0.2)" : "rgba(255,68,68,0.2)" })));

      // EMAs
      const ema9 = mainChart.addLineSeries({ color: "#00d4ff", lineWidth: 1, title: "EMA9" });
      ema9.setData(data.ema_lines.ema_9);
      const ema21 = mainChart.addLineSeries({ color: "#ffd600", lineWidth: 1, title: "EMA21" });
      ema21.setData(data.ema_lines.ema_21);
      if (data.ema_lines.ema_200?.length) {
        const ema200 = mainChart.addLineSeries({ color: "#ff4444", lineWidth: 1, lineStyle: 2, title: "EMA200" });
        ema200.setData(data.ema_lines.ema_200);
      }

      // Bollinger Bands
      const bbUpper = mainChart.addLineSeries({ color: "rgba(0,212,255,0.3)", lineWidth: 1, lineStyle: 3 });
      bbUpper.setData(data.bollinger.upper);
      const bbMiddle = mainChart.addLineSeries({ color: "rgba(0,212,255,0.15)", lineWidth: 1, lineStyle: 3 });
      bbMiddle.setData(data.bollinger.middle);
      const bbLower = mainChart.addLineSeries({ color: "rgba(0,212,255,0.3)", lineWidth: 1, lineStyle: 3 });
      bbLower.setData(data.bollinger.lower);

      mainChart.timeScale().fitContent();

      // ── RSI panel ──
      const rsiChart = LightweightCharts.createChart(rsiRef.current!, {
        ...chartOpts,
        height: 100,
      });
      const rsiSeries = rsiChart.addLineSeries({ color: "#a78bfa", lineWidth: 1, title: "RSI(14)" });
      rsiSeries.setData(data.rsi_series);
      // Overbought/oversold lines
      const ob = rsiChart.addLineSeries({ color: "rgba(255,68,68,0.4)", lineWidth: 1, lineStyle: 2 });
      ob.setData(data.rsi_series.map((d) => ({ time: d.time, value: 70 })));
      const os = rsiChart.addLineSeries({ color: "rgba(0,230,118,0.4)", lineWidth: 1, lineStyle: 2 });
      os.setData(data.rsi_series.map((d) => ({ time: d.time, value: 30 })));
      rsiChart.timeScale().fitContent();

      // ── MACD panel ──
      const macdChart = LightweightCharts.createChart(macdRef.current!, {
        ...chartOpts,
        height: 100,
      });
      const macdLine = macdChart.addLineSeries({ color: "#00d4ff", lineWidth: 1, title: "MACD" });
      macdLine.setData(data.macd.macd_series);
      const signalLine = macdChart.addLineSeries({ color: "#ffd600", lineWidth: 1, title: "Signal" });
      signalLine.setData(data.macd.signal_series);
      const histSeries = macdChart.addHistogramSeries({ title: "Histogram" });
      histSeries.setData(
        data.macd.histogram_series.map((d) => ({
          time: d.time,
          value: d.value,
          color: d.value >= 0 ? "rgba(0,230,118,0.5)" : "rgba(255,68,68,0.5)",
        }))
      );
      macdChart.timeScale().fitContent();

      // Sync timescales
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) {
          rsiChart.timeScale().setVisibleLogicalRange(range);
          macdChart.timeScale().setVisibleLogicalRange(range);
        }
      });

      return () => {
        mainChart.remove();
        rsiChart.remove();
        macdChart.remove();
      };
    };

    let cleanup: (() => void) | undefined;
    init().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [data, ticker]);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Legend */}
      <div className="flex gap-4 px-2 py-1.5 text-xs font-mono flex-wrap">
        <span style={{ color: "#00d4ff" }}>── EMA9</span>
        <span style={{ color: "#ffd600" }}>── EMA21</span>
        <span style={{ color: "#ff4444" }}>- - EMA200</span>
        <span style={{ color: "rgba(0,212,255,0.5)" }}>⋯ BB Bands</span>
      </div>
      <div ref={mainRef} className="w-full rounded-t-lg overflow-hidden" />
      {/* RSI label */}
      <div className="bg-surface px-2 py-0.5 text-[10px] font-mono text-muted border-t border-border">RSI (14) — Overbought: 70 · Oversold: 30</div>
      <div ref={rsiRef} className="w-full overflow-hidden" />
      {/* MACD label */}
      <div className="bg-surface px-2 py-0.5 text-[10px] font-mono text-muted border-t border-border">MACD (12,26,9)</div>
      <div ref={macdRef} className="w-full rounded-b-lg overflow-hidden" />
    </div>
  );
}
