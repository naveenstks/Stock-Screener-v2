"use client";

import { useState } from "react";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { fetchChartData } from "@/lib/api";
import { TrendingUp, TrendingDown, X, ChevronDown, ChevronUp } from "lucide-react";

interface StockRowProps {
  stock: Record<string, unknown>;
  rank: number;
}

export function StockRow({ stock, rank }: StockRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [chartData, setChartData] = useState<unknown>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  const signal = stock.signal as string;
  const rowClass = signal === "green" ? "row-green" : signal === "yellow" ? "row-yellow" : "row-red";

  const handleExpand = async () => {
    if (!expanded && !chartData) {
      setLoadingChart(true);
      try {
        const res = await fetchChartData(stock.ticker as string);
        setChartData(res.chart);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingChart(false);
      }
    }
    setExpanded(!expanded);
  };

  const fmt = (v: unknown, decimals = 2) =>
    v != null && !isNaN(Number(v)) ? Number(v).toFixed(decimals) : "N/A";
  const fmtPct = (v: unknown) =>
    v != null && !isNaN(Number(v)) ? `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "N/A";

  const macdBullish = stock.macd_crossover === "bullish";
  const macdBearish = stock.macd_crossover === "bearish";

  return (
    <>
      <tr
        className={`${rowClass} border-b border-border cursor-pointer hover:bg-white/[0.03] transition-colors`}
        onClick={handleExpand}
      >
        {/* Rank */}
        <td className="px-3 py-2.5 text-center">
          <span className="font-display text-lg text-muted">{rank}</span>
        </td>
        {/* Ticker */}
        <td className="px-3 py-2.5">
          <div className="flex flex-col">
            <span className="font-mono font-semibold text-accent text-sm">{stock.ticker as string}</span>
            <span className="text-[10px] text-muted">{stock.exchange as string}</span>
          </div>
        </td>
        {/* Sector */}
        <td className="px-3 py-2.5 text-xs text-muted hidden lg:table-cell">
          {(stock.sector as string) || "N/A"}
        </td>
        {/* Score */}
        <td className="px-3 py-2.5 w-28">
          <ScoreBar score={Number(stock.composite_score)} size="sm" />
        </td>
        {/* Price */}
        <td className="px-3 py-2.5 font-mono text-sm text-right">
          ${fmt(stock.price)}
        </td>
        {/* Vol Ratio */}
        <td className="px-3 py-2.5 font-mono text-sm text-right">
          <span className="text-accent font-semibold">{fmt(stock.vol_ratio, 1)}x</span>
        </td>
        {/* RSI */}
        <td className="px-3 py-2.5 font-mono text-sm text-right">
          <span className={Number(stock.rsi) > 60 ? "text-green" : Number(stock.rsi) < 40 ? "text-red" : "text-yellow"}>
            {fmt(stock.rsi, 1)}
          </span>
        </td>
        {/* MACD */}
        <td className="px-3 py-2.5 text-center hidden md:table-cell">
          {macdBullish ? (
            <span className="flex items-center justify-center gap-1 text-green text-xs font-semibold">
              <TrendingUp size={12} /> Bull
            </span>
          ) : macdBearish ? (
            <span className="flex items-center justify-center gap-1 text-red text-xs font-semibold">
              <TrendingDown size={12} /> Bear
            </span>
          ) : (
            <span className="text-muted text-xs">{fmt(stock.macd, 3)}</span>
          )}
        </td>
        {/* EMA 21 */}
        <td className="px-3 py-2.5 font-mono text-xs text-right hidden xl:table-cell">
          ${fmt(stock.ema_21)}
        </td>
        {/* BB %B */}
        <td className="px-3 py-2.5 font-mono text-xs text-right hidden xl:table-cell">
          {fmt(stock.bb_pct_b, 2)}
        </td>
        {/* ATR% */}
        <td className="px-3 py-2.5 font-mono text-xs text-right hidden xl:table-cell">
          {fmt(stock.atr_pct, 2)}%
        </td>
        {/* 52W from High */}
        <td className="px-3 py-2.5 font-mono text-xs text-right hidden lg:table-cell">
          <span className={Number(stock.pct_from_52_high) > -5 ? "text-green" : "text-muted"}>
            {fmtPct(stock.pct_from_52_high)}
          </span>
        </td>
        {/* Earnings */}
        <td className="px-3 py-2.5 text-xs hidden md:table-cell">
          {stock.earnings_badge ? (
            <span className="text-yellow font-semibold">{stock.earnings_badge as string}</span>
          ) : (
            <span className="text-muted">{stock.next_earnings as string}</span>
          )}
        </td>
        {/* Expand */}
        <td className="px-3 py-2.5 text-center">
          {expanded ? <ChevronUp size={14} className="text-muted mx-auto" /> : <ChevronDown size={14} className="text-muted mx-auto" />}
        </td>
      </tr>

      {/* Expanded Chart Row */}
      {expanded && (
        <tr className="bg-surface">
          <td colSpan={14} className="p-4">
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl text-accent">{stock.ticker as string}</span>
                  <span className="text-sm text-muted">{stock.sector as string}</span>
                </div>
                <div className="flex gap-6 text-xs font-mono">
                  <span>EMA9 <span className="text-accent">${fmt(stock.ema_9)}</span></span>
                  <span>EMA21 <span className="text-yellow">${fmt(stock.ema_21)}</span></span>
                  <span>EMA200 <span className="text-red">${fmt(stock.ema_200)}</span></span>
                  <span>BB Upper <span className="text-text">${fmt(stock.bb_upper)}</span></span>
                  <span>BB Lower <span className="text-text">${fmt(stock.bb_lower)}</span></span>
                  <span>ATR <span className="text-text">{fmt(stock.atr_pct)}%</span></span>
                  <span>52W High <span className="text-text">${fmt(stock.week_52_high)}</span></span>
                  <span>P/C <span className="text-text">{stock.put_call_ratio as string}</span></span>
                </div>
              </div>

              {/* Chart */}
              <div className="p-2">
                {loadingChart ? (
                  <div className="flex items-center justify-center h-48 text-muted animate-scan font-mono text-sm">
                    Loading chart data for {stock.ticker as string}...
                  </div>
                ) : chartData ? (
                  <CandlestickChart data={chartData as ChartProps["data"]} ticker={stock.ticker as string} />
                ) : (
                  <div className="text-center text-muted py-12 text-sm">Chart data unavailable</div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
