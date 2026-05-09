"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { startScan, fetchScanStatus, fetchScanResults } from "@/lib/api";
import { StockRow } from "@/components/StockRow";
import {
  SlidersHorizontal, RefreshCw, Download, ChevronUp, ChevronDown,
  Activity, TrendingUp, Clock, BarChart2, X
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Filters {
  pe_enabled: boolean;
  max_pe: number;
  min_vol_ratio: number;
  min_rsi: number;
  min_market_cap: number;
  price_above_ema: boolean;
}

const DEFAULT_FILTERS: Filters = {
  pe_enabled: true,
  max_pe: 50,
  min_vol_ratio: 2.0,
  min_rsi: 50,
  min_market_cap: 2.0,
  price_above_ema: true,
};

const CAP_OPTIONS = [
  { label: "$500M", value: 0.5 },
  { label: "$1B", value: 1.0 },
  { label: "$2B", value: 2.0 },
  { label: "$5B", value: 5.0 },
  { label: "$10B+", value: 10.0 },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, ticker: "" });
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState("composite_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [customTickers, setCustomTickers] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [filterTab, setFilterTab] = useState<"basic" | "advanced">("basic");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling scan status ────────────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const status = await fetchScanStatus();
      setProgress({ current: status.progress, total: status.total, ticker: status.current_ticker });
      if (!status.running) {
        clearInterval(pollRef.current!);
        const data = await fetchScanResults();
        setResults(data.results || []);
        setLastScanTime(data.last_scan_time);
        setElapsed(data.elapsed);
        setScanning(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setResults([]);
    const params: Record<string, unknown> = { ...filters };
    if (customTickers.trim()) params.tickers = customTickers.trim();
    await startScan(params);
    pollRef.current = setInterval(pollStatus, 1500);
  }, [scanning, filters, customTickers, pollStatus]);

  // ── Auto-refresh countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (autoRefresh === 0) { clearInterval(countdownRef.current!); return; }
    setCountdown(autoRefresh);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { handleScan(); return autoRefresh; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current!);
  }, [autoRefresh, handleScan]);

  useEffect(() => () => { clearInterval(pollRef.current!); clearInterval(countdownRef.current!); }, []);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sorted = [...results].sort((a, b) => {
    const av = Number(a[sortCol]) || 0;
    const bv = Number(b[sortCol]) || 0;
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!results.length) return;
    const keys = Object.keys(results[0]).filter((k) => !k.startsWith("_"));
    const rows = [keys.join(","), ...results.map((r) => keys.map((k) => r[k] ?? "").join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screener_${Date.now()}.csv`;
    a.click();
  };

  // ── Sort header ────────────────────────────────────────────────────────────
  const SortTh = ({ col, label, cls = "" }: { col: string; label: string; cls?: string }) => (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-text transition-colors ${cls}`}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortCol === col ? (
          sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
        ) : (
          <span className="opacity-20"><ChevronDown size={11} /></span>
        )}
      </span>
    </th>
  );

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg font-body">

      {/* ── Top Bar ── */}
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-accent" />
            <span className="font-display text-2xl tracking-wider text-text">US EQUITIES SCREENER</span>
            <span className="hidden sm:block text-[10px] font-mono text-muted bg-card border border-border px-2 py-0.5 rounded">
              S&P 500 · NYSE + NASDAQ
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh */}
            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(Number(e.target.value))}
              className="text-xs bg-card border border-border text-muted rounded px-2 py-1.5 hidden sm:block"
            >
              <option value={0}>Manual</option>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={900}>15 min</option>
            </select>
            {autoRefresh > 0 && !scanning && (
              <span className="text-xs font-mono text-accent hidden sm:block">↺ {countdown}s</span>
            )}
            <button onClick={exportCSV} disabled={!results.length}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted hover:text-text hover:border-accent/50 transition-colors disabled:opacity-30">
              <Download size={13} /> CSV
            </button>
            <button onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted hover:text-text hover:border-accent/50 transition-colors">
              <SlidersHorizontal size={13} /> Filters
            </button>
            <button onClick={handleScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-1.5 rounded bg-accent/10 border border-accent/40 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50 text-sm font-semibold">
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="border-b border-border bg-surface animate-up">
          <div className="max-w-[1600px] mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
                {(["basic", "advanced"] as const).map((tab) => (
                  <button key={tab} onClick={() => setFilterTab(tab)}
                    className={`text-xs px-3 py-1 rounded capitalize transition-colors ${filterTab === tab ? "bg-accent/20 text-accent border border-accent/40" : "text-muted hover:text-text"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-xs text-muted hover:text-text transition-colors">↺ Reset</button>
                <button onClick={() => setShowFilters(false)}><X size={14} className="text-muted" /></button>
              </div>
            </div>

            {filterTab === "basic" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <label className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={filters.pe_enabled}
                      onChange={(e) => setFilters({ ...filters, pe_enabled: e.target.checked })}
                      className="accent-accent" />
                    <span className="text-xs text-muted">Max P/E</span>
                  </div>
                  <input type="number" value={filters.max_pe} disabled={!filters.pe_enabled}
                    onChange={(e) => setFilters({ ...filters, max_pe: Number(e.target.value) })}
                    className="bg-card border border-border rounded px-2 py-1.5 text-sm font-mono text-text disabled:opacity-40" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Min Vol Ratio ({filters.min_vol_ratio}x)</span>
                  <input type="range" min={1} max={10} step={0.1} value={filters.min_vol_ratio}
                    onChange={(e) => setFilters({ ...filters, min_vol_ratio: Number(e.target.value) })}
                    className="accent-accent" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Min RSI ({filters.min_rsi})</span>
                  <input type="range" min={1} max={99} value={filters.min_rsi}
                    onChange={(e) => setFilters({ ...filters, min_rsi: Number(e.target.value) })}
                    className="accent-accent" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Min Market Cap</span>
                  <select value={filters.min_market_cap}
                    onChange={(e) => setFilters({ ...filters, min_market_cap: Number(e.target.value) })}
                    className="bg-card border border-border rounded px-2 py-1.5 text-sm text-text">
                    {CAP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.price_above_ema}
                    onChange={(e) => setFilters({ ...filters, price_above_ema: e.target.checked })}
                    className="accent-accent" />
                  <span className="text-xs text-muted">Price &gt; 21 EMA</span>
                </label>
              </div>
            )}

            {filterTab === "advanced" && (
              <div className="flex flex-col gap-1">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Custom Tickers (comma-separated — overrides S&P 500 default)</span>
                  <input type="text" value={customTickers}
                    onChange={(e) => setCustomTickers(e.target.value)}
                    placeholder="AAPL, MSFT, NVDA, TSLA..."
                    className="bg-card border border-border rounded px-3 py-2 text-sm font-mono text-text w-full max-w-xl" />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Progress Bar ── */}
      {scanning && (
        <div className="border-b border-border bg-surface">
          <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center gap-4">
            <Activity size={14} className="text-accent animate-scan shrink-0" />
            <div className="flex-1">
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div className="h-1 bg-accent rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="font-mono text-xs text-muted shrink-0">
              Scanning <span className="text-accent">{progress.ticker}</span>... ({progress.current}/{progress.total}) — {pct}%
            </span>
          </div>
        </div>
      )}

      {/* ── Metrics ── */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { icon: <TrendingUp size={16} />, label: "Matched", value: results.length || "—" },
            { icon: <BarChart2 size={16} />, label: "Universe", value: customTickers ? "Custom" : "S&P 500" },
            { icon: <Clock size={16} />, label: "Scan Time", value: elapsed ? `${elapsed}s` : "—" },
            { icon: <Activity size={16} />, label: "Last Scan", value: lastScanTime ? lastScanTime.slice(11, 19) : "Never" },
          ].map((m, i) => (
            <div key={i} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-accent">{m.icon}</span>
              <div>
                <div className="font-display text-xl text-text">{m.value}</div>
                <div className="text-[10px] text-muted uppercase tracking-wider">{m.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Results Table ── */}
        {sorted.length > 0 ? (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-border text-muted">
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider w-10">#</th>
                    <SortTh col="ticker" label="Ticker" />
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider hidden lg:table-cell text-muted">Sector</th>
                    <SortTh col="composite_score" label="Score" cls="w-32" />
                    <SortTh col="price" label="Price" />
                    <SortTh col="vol_ratio" label="Vol Ratio" />
                    <SortTh col="rsi" label="RSI" />
                    <SortTh col="macd" label="MACD" cls="hidden md:table-cell" />
                    <SortTh col="ema_21" label="EMA21" cls="hidden xl:table-cell" />
                    <SortTh col="bb_pct_b" label="BB %B" cls="hidden xl:table-cell" />
                    <SortTh col="atr_pct" label="ATR%" cls="hidden xl:table-cell" />
                    <SortTh col="pct_from_52_high" label="52W High" cls="hidden lg:table-cell" />
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider hidden md:table-cell text-muted">Earnings</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((stock, i) => (
                    <StockRow key={stock.ticker as string} stock={stock} rank={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !scanning && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BarChart2 size={48} className="text-border mb-4" />
            <p className="font-display text-3xl text-muted tracking-wider mb-2">READY TO SCAN</p>
            <p className="text-sm text-muted">Configure filters above and click <span className="text-accent font-semibold">Scan Now</span></p>
          </div>
        )}

        {/* ── Legend ── */}
        {sorted.length > 0 && (
          <div className="flex gap-4 mt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green/20 border-l-2 border-green inline-block" /> Strong signal (score ≥65)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow/20 border-l-2 border-yellow inline-block" /> Moderate (score 40–65)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red/20 border-l-2 border-red inline-block" /> Weak signal (score &lt;40)</span>
            <span className="ml-auto">Click any row to expand chart ↕</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border mt-8 py-4">
        <p className="text-center text-[11px] text-muted">
          Data via yfinance (unofficial) · Put/Call via CBOE · Not financial advice
        </p>
      </footer>
    </div>
  );
}
