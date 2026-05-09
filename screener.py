"""
Core screening pipeline with all indicators + composite score.
"""

import time
import yfinance as yf
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from cachetools import TTLCache
from datetime import datetime, timedelta

from indicators import (
    calculate_rsi, calculate_volume_ratio, get_latest_emas,
    calculate_macd, calculate_bollinger_bands, calculate_atr,
    calculate_52_week, calculate_composite_score, signal_strength,
    build_chart_data
)
from cboe import get_put_call_ratio
from ticker_list import TICKER_EXCHANGE

_cache: TTLCache = TTLCache(maxsize=600, ttl=60)
MAX_WORKERS = 5
FETCH_DELAY = 0.3
MAX_RETRIES = 3


def _fetch_ticker_data(ticker: str) -> dict | None:
    if ticker in _cache:
        return _cache[ticker]

    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(FETCH_DELAY)
            t = yf.Ticker(ticker)

            # 1 year daily history for all indicators
            hist = t.history(period="1y", interval="1d", auto_adjust=True)
            if hist is None or hist.empty or len(hist) < 30:
                return None

            close = hist["Close"]
            high = hist["High"]
            low = hist["Low"]
            volume = hist["Volume"]

            # Indicators
            emas = get_latest_emas(close)
            rsi = calculate_rsi(close, 14)
            vol_ratio = calculate_volume_ratio(volume, 20)
            macd = calculate_macd(close)
            bb = calculate_bollinger_bands(close)
            atr = calculate_atr(high, low, close)
            week52 = calculate_52_week(high, low, close)
            current_price = round(float(close.iloc[-1]), 2)

            # Fundamentals
            info = t.info or {}
            pe = info.get("trailingPE") or info.get("forwardPE")
            market_cap = info.get("marketCap")
            sector = info.get("sector", "N/A")
            exchange = TICKER_EXCHANGE.get(ticker, info.get("exchange", "N/A"))

            # Earnings date
            earnings_str = "N/A"
            earnings_badge = ""
            try:
                cal = t.calendar
                if cal is not None and not cal.empty:
                    if "Earnings Date" in cal.index:
                        ed_val = cal.loc["Earnings Date"].iloc[0]
                        if pd.notna(ed_val):
                            earnings_date = pd.to_datetime(ed_val).date()
                            days_to = (earnings_date - datetime.now().date()).days
                            earnings_str = str(earnings_date)
                            if 0 <= days_to <= 3:
                                earnings_badge = "⚠️ Earnings Soon"
            except Exception:
                pass

            # Composite score
            composite_score = calculate_composite_score(
                rsi=rsi,
                vol_ratio=vol_ratio,
                price=current_price,
                ema_21=emas.get("ema_21"),
                macd_histogram=macd.get("histogram"),
                atr_pct=atr.get("atr_pct"),
                pct_b=bb.get("pct_b"),
                pct_from_high=week52.get("pct_from_high"),
            )

            result = {
                # Identity
                "ticker": ticker,
                "exchange": exchange,
                "sector": sector,
                # Price
                "price": current_price,
                # Fundamentals
                "pe": round(pe, 2) if pe else None,
                "market_cap_b": round(market_cap / 1e9, 2) if market_cap else None,
                "_raw_market_cap": market_cap,
                "_raw_pe": pe,
                # Volume
                "vol_ratio": vol_ratio,
                # EMAs
                "ema_9": emas.get("ema_9"),
                "ema_21": emas.get("ema_21"),
                "ema_200": emas.get("ema_200"),
                # RSI
                "rsi": rsi,
                # MACD
                "macd": macd.get("macd"),
                "macd_signal": macd.get("signal_line"),
                "macd_histogram": macd.get("histogram"),
                "macd_crossover": macd.get("crossover"),
                # Bollinger Bands
                "bb_upper": bb.get("upper"),
                "bb_middle": bb.get("middle"),
                "bb_lower": bb.get("lower"),
                "bb_pct_b": bb.get("pct_b"),
                "bb_bandwidth": bb.get("bandwidth"),
                # ATR
                "atr": atr.get("atr"),
                "atr_pct": atr.get("atr_pct"),
                # 52-week
                "week_52_high": week52.get("week_52_high"),
                "week_52_low": week52.get("week_52_low"),
                "pct_from_52_high": week52.get("pct_from_high"),
                "pct_from_52_low": week52.get("pct_from_low"),
                # Composite
                "composite_score": composite_score,
                # Earnings
                "next_earnings": earnings_str,
                "earnings_badge": earnings_badge,
                # Put/Call
                "put_call_ratio": get_put_call_ratio(ticker),
            }

            _cache[ticker] = result
            return result

        except Exception:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                return None

    return None


def _passes_filters(row: dict, filters: dict) -> bool:
    pe = row.get("_raw_pe")
    vol_ratio = row.get("vol_ratio")
    rsi = row.get("rsi")
    market_cap = row.get("_raw_market_cap")
    price = row.get("price")
    ema_21 = row.get("ema_21")

    if filters.get("pe_enabled", True):
        if pe is None or pe <= 0 or pe >= filters["max_pe"]:
            return False

    if vol_ratio is None or np.isnan(vol_ratio) or vol_ratio < filters["min_vol_ratio"]:
        return False

    if rsi is None or np.isnan(rsi) or rsi < filters["min_rsi"]:
        return False

    min_cap = filters["min_market_cap"] * 1e9
    if market_cap is None or market_cap < min_cap:
        return False

    if filters.get("price_above_ema", True):
        if price is None or ema_21 is None or np.isnan(ema_21) or price <= ema_21:
            return False

    return True


def run_screen(tickers: list, filters: dict, progress_callback=None) -> list:
    results = []
    total = len(tickers)
    completed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_ticker = {executor.submit(_fetch_ticker_data, t): t for t in tickers}

        for future in as_completed(future_to_ticker):
            ticker = future_to_ticker[future]
            completed += 1
            if progress_callback:
                progress_callback(completed, total, ticker)

            try:
                data = future.result()
                if data and _passes_filters(data, filters):
                    data["signal"] = signal_strength({
                        "rsi": data["rsi"],
                        "vol_ratio": data["vol_ratio"],
                        "price": data["price"],
                        "ema_21": data["ema_21"],
                        "composite_score": data["composite_score"],
                    })
                    results.append(data)
            except Exception:
                pass

    # Primary rank: composite score, secondary: vol_ratio
    results.sort(key=lambda r: (r.get("composite_score") or 0, r.get("vol_ratio") or 0), reverse=True)
    return results


def format_results(results: list) -> list:
    """Convert results list to clean serializable list of dicts."""
    formatted = []
    for r in results:
        formatted.append({
            "ticker": r.get("ticker"),
            "exchange": r.get("exchange"),
            "sector": r.get("sector"),
            "price": r.get("price"),
            "pe": r.get("pe"),
            "market_cap_b": r.get("market_cap_b"),
            "vol_ratio": r.get("vol_ratio"),
            "ema_9": r.get("ema_9"),
            "ema_21": r.get("ema_21"),
            "ema_200": r.get("ema_200"),
            "rsi": r.get("rsi"),
            "macd": r.get("macd"),
            "macd_signal": r.get("macd_signal"),
            "macd_histogram": r.get("macd_histogram"),
            "macd_crossover": r.get("macd_crossover"),
            "bb_upper": r.get("bb_upper"),
            "bb_middle": r.get("bb_middle"),
            "bb_lower": r.get("bb_lower"),
            "bb_pct_b": r.get("bb_pct_b"),
            "atr": r.get("atr"),
            "atr_pct": r.get("atr_pct"),
            "week_52_high": r.get("week_52_high"),
            "week_52_low": r.get("week_52_low"),
            "pct_from_52_high": r.get("pct_from_52_high"),
            "pct_from_52_low": r.get("pct_from_52_low"),
            "composite_score": r.get("composite_score"),
            "signal": r.get("signal"),
            "next_earnings": r.get("next_earnings"),
            "earnings_badge": r.get("earnings_badge"),
            "put_call_ratio": r.get("put_call_ratio"),
        })
    return formatted


def get_chart_data(ticker: str) -> dict | None:
    """Fetch and build full chart payload for a single ticker."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="1y", interval="1d", auto_adjust=True)
        if hist is None or hist.empty:
            return None
        return build_chart_data(hist)
    except Exception:
        return None
