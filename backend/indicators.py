"""
Local indicator calculations:
EMA, RSI, MACD, Bollinger Bands, ATR, 52-Week High/Low, Volume Ratio, Composite Score
All computed from raw OHLCV data — no yfinance indicators used.
"""

import pandas as pd
import numpy as np


# ── Core Indicators ───────────────────────────────────────────────────────────

def calculate_ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def calculate_rsi(series: pd.Series, period: int = 14) -> float:
    if len(series) < period + 1:
        return float("nan")
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, float("nan"))
    rsi = 100 - (100 / (1 + rs))
    return round(float(rsi.iloc[-1]), 2)


def calculate_volume_ratio(volume: pd.Series, lookback: int = 20) -> float:
    if len(volume) < lookback + 1:
        return float("nan")
    avg_vol = volume.iloc[-lookback - 1:-1].mean()
    if avg_vol == 0:
        return float("nan")
    return round(float(volume.iloc[-1] / avg_vol), 2)


def get_latest_emas(close: pd.Series) -> dict:
    result = {}
    for period in [9, 21, 200]:
        if len(close) >= period:
            result[f"ema_{period}"] = round(float(calculate_ema(close, period).iloc[-1]), 2)
        else:
            result[f"ema_{period}"] = float("nan")
    return result


# ── MACD ──────────────────────────────────────────────────────────────────────

def calculate_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """
    Returns MACD line, Signal line, Histogram, and crossover signal.
    """
    if len(close) < slow + signal:
        return {"macd": None, "signal": None, "histogram": None, "crossover": None}

    ema_fast = calculate_ema(close, fast)
    ema_slow = calculate_ema(close, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calculate_ema(macd_line, signal)
    histogram = macd_line - signal_line

    # Crossover: bullish if MACD crossed above signal in last 2 bars
    crossover = None
    if len(macd_line) >= 2:
        if macd_line.iloc[-2] < signal_line.iloc[-2] and macd_line.iloc[-1] > signal_line.iloc[-1]:
            crossover = "bullish"
        elif macd_line.iloc[-2] > signal_line.iloc[-2] and macd_line.iloc[-1] < signal_line.iloc[-1]:
            crossover = "bearish"

    return {
        "macd": round(float(macd_line.iloc[-1]), 4),
        "signal_line": round(float(signal_line.iloc[-1]), 4),
        "histogram": round(float(histogram.iloc[-1]), 4),
        "crossover": crossover,
        # Full series for charting (last 60 bars)
        "macd_series": [round(v, 4) for v in macd_line.iloc[-60:].tolist()],
        "signal_series": [round(v, 4) for v in signal_line.iloc[-60:].tolist()],
        "histogram_series": [round(v, 4) for v in histogram.iloc[-60:].tolist()],
    }


# ── Bollinger Bands ───────────────────────────────────────────────────────────

def calculate_bollinger_bands(close: pd.Series, period: int = 20, std_dev: float = 2.0) -> dict:
    """
    Returns upper, middle, lower bands, %B, and bandwidth.
    """
    if len(close) < period:
        return {"upper": None, "middle": None, "lower": None, "pct_b": None, "bandwidth": None}

    middle = close.rolling(period).mean()
    std = close.rolling(period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)

    curr_price = float(close.iloc[-1])
    curr_upper = float(upper.iloc[-1])
    curr_lower = float(lower.iloc[-1])
    curr_middle = float(middle.iloc[-1])

    pct_b = (curr_price - curr_lower) / (curr_upper - curr_lower) if (curr_upper - curr_lower) != 0 else 0.5
    bandwidth = (curr_upper - curr_lower) / curr_middle if curr_middle != 0 else 0

    return {
        "upper": round(curr_upper, 2),
        "middle": round(curr_middle, 2),
        "lower": round(curr_lower, 2),
        "pct_b": round(pct_b, 3),
        "bandwidth": round(bandwidth, 4),
        # Series for charting (last 60 bars)
        "upper_series": [round(v, 2) if not np.isnan(v) else None for v in upper.iloc[-60:].tolist()],
        "middle_series": [round(v, 2) if not np.isnan(v) else None for v in middle.iloc[-60:].tolist()],
        "lower_series": [round(v, 2) if not np.isnan(v) else None for v in lower.iloc[-60:].tolist()],
    }


# ── ATR ───────────────────────────────────────────────────────────────────────

def calculate_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> dict:
    """
    Average True Range — measures volatility.
    """
    if len(close) < period + 1:
        return {"atr": None, "atr_pct": None}

    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)

    atr = tr.ewm(span=period, adjust=False).mean()
    atr_val = float(atr.iloc[-1])
    atr_pct = round(atr_val / float(close.iloc[-1]) * 100, 2) if float(close.iloc[-1]) != 0 else None

    return {
        "atr": round(atr_val, 2),
        "atr_pct": atr_pct,  # ATR as % of price — more useful for comparison
    }


# ── 52-Week High / Low ────────────────────────────────────────────────────────

def calculate_52_week(high: pd.Series, low: pd.Series, close: pd.Series) -> dict:
    """
    Returns 52-week high/low and % from current price.
    """
    if len(close) < 2:
        return {"week_52_high": None, "week_52_low": None, "pct_from_high": None, "pct_from_low": None}

    bars_252 = min(252, len(close))
    week_high = float(high.iloc[-bars_252:].max())
    week_low = float(low.iloc[-bars_252:].min())
    curr = float(close.iloc[-1])

    pct_from_high = round((curr - week_high) / week_high * 100, 2) if week_high else None
    pct_from_low = round((curr - week_low) / week_low * 100, 2) if week_low else None

    return {
        "week_52_high": round(week_high, 2),
        "week_52_low": round(week_low, 2),
        "pct_from_high": pct_from_high,  # negative = below 52w high
        "pct_from_low": pct_from_low,    # positive = above 52w low
    }


# ── Composite Score ───────────────────────────────────────────────────────────

def calculate_composite_score(
    rsi: float,
    vol_ratio: float,
    price: float,
    ema_21: float,
    macd_histogram: float,
    atr_pct: float,
    pct_b: float,
    pct_from_high: float,
    weights: dict = None,
) -> float:
    """
    Composite momentum score 0-100.
    Default weights: Vol Ratio 40%, RSI 30%, EMA position 20%, MACD 10%
    Each component is normalized to 0-100 before weighting.
    """
    if weights is None:
        weights = {
            "vol_ratio": 0.40,
            "rsi": 0.30,
            "ema_position": 0.20,
            "macd": 0.10,
        }

    scores = {}

    # RSI score: 50-80 is ideal range → normalize 50-80 to 0-100
    try:
        rsi_score = max(0, min(100, (rsi - 50) / 30 * 100)) if rsi else 0
        scores["rsi"] = rsi_score
    except Exception:
        scores["rsi"] = 0

    # Volume ratio score: cap at 5x → normalize 1-5 to 0-100
    try:
        vol_score = max(0, min(100, (vol_ratio - 1) / 4 * 100)) if vol_ratio else 0
        scores["vol_ratio"] = vol_score
    except Exception:
        scores["vol_ratio"] = 0

    # EMA position score: % above 21 EMA, cap at 10% above → 0-100
    try:
        if price and ema_21 and ema_21 != 0:
            pct_above = (price - ema_21) / ema_21 * 100
            ema_score = max(0, min(100, pct_above / 10 * 100))
        else:
            ema_score = 0
        scores["ema_position"] = ema_score
    except Exception:
        scores["ema_position"] = 0

    # MACD histogram score: positive = bullish, normalize -0.5 to +0.5 → 0-100
    try:
        if macd_histogram is not None:
            macd_score = max(0, min(100, (macd_histogram + 0.5) / 1.0 * 100))
        else:
            macd_score = 50
        scores["macd"] = macd_score
    except Exception:
        scores["macd"] = 50

    # Weighted composite
    total = sum(scores[k] * weights.get(k, 0) for k in scores)
    return round(total, 1)


# ── Signal Strength ───────────────────────────────────────────────────────────

def signal_strength(row: dict) -> str:
    rsi = row.get("rsi") or 0
    vol_ratio = row.get("vol_ratio") or 0
    price = row.get("price") or 0
    ema_21 = row.get("ema_21") or 0
    score = row.get("composite_score") or 0
    price_pct_above = ((price - ema_21) / ema_21 * 100) if ema_21 else 0

    if score >= 65 and rsi > 60 and vol_ratio > 3.0 and price_pct_above > 1.0:
        return "green"
    elif score >= 40 or (50 <= rsi <= 60) or (2.0 <= vol_ratio <= 2.5):
        return "yellow"
    else:
        return "red"


# ── Chart Data Builder ────────────────────────────────────────────────────────

def build_chart_data(hist: "pd.DataFrame") -> dict:
    """
    Build full chart payload for the frontend:
    - OHLCV candlestick data (last 90 days)
    - EMA lines (9, 21, 200)
    - Volume bars
    - RSI
    - MACD
    - Bollinger Bands
    """
    close = hist["Close"]
    high = hist["High"]
    low = hist["Low"]
    volume = hist["Volume"]
    dates = hist.index

    n = min(90, len(hist))
    hist_90 = hist.iloc[-n:]
    close_90 = hist_90["Close"]
    dates_90 = hist_90.index

    # Format dates as strings
    date_strs = [str(d)[:10] for d in dates_90]

    # Candlestick OHLCV
    candles = []
    for i in range(len(hist_90)):
        candles.append({
            "time": date_strs[i],
            "open": round(float(hist_90["Open"].iloc[i]), 2),
            "high": round(float(hist_90["High"].iloc[i]), 2),
            "low": round(float(hist_90["Low"].iloc[i]), 2),
            "close": round(float(hist_90["Close"].iloc[i]), 2),
            "volume": int(hist_90["Volume"].iloc[i]),
        })

    # EMA series (full history first, then slice last 90)
    ema_9_full = calculate_ema(close, 9).iloc[-n:]
    ema_21_full = calculate_ema(close, 21).iloc[-n:]
    ema_200_full = calculate_ema(close, 200).iloc[-n:] if len(close) >= 200 else pd.Series([float("nan")] * n)

    ema_lines = {
        "ema_9": [{"time": date_strs[i], "value": round(float(ema_9_full.iloc[i]), 2)} for i in range(n)],
        "ema_21": [{"time": date_strs[i], "value": round(float(ema_21_full.iloc[i]), 2)} for i in range(n)],
        "ema_200": [{"time": date_strs[i], "value": round(float(v), 2)} if not np.isnan(float(v)) else None
                    for i, v in enumerate(ema_200_full)],
    }
    ema_lines["ema_200"] = [x for x in ema_lines["ema_200"] if x is not None]

    # RSI series
    rsi_series = []
    for i in range(14, len(close_90)):
        rsi_val = calculate_rsi(close_90.iloc[:i+1], 14)
        rsi_series.append({"time": date_strs[i], "value": rsi_val})

    # MACD series
    macd_data = calculate_macd(close)
    macd_series = []
    signal_series = []
    hist_series = []
    macd_start = max(0, n - 60)
    for i, d in enumerate(date_strs[macd_start:]):
        idx = i
        if idx < len(macd_data["macd_series"]):
            macd_series.append({"time": d, "value": macd_data["macd_series"][idx]})
            signal_series.append({"time": d, "value": macd_data["signal_series"][idx]})
            hist_series.append({"time": d, "value": macd_data["histogram_series"][idx]})

    # Bollinger Bands series
    bb_data = calculate_bollinger_bands(close)
    bb_upper = [{"time": date_strs[i], "value": v} for i, v in enumerate(bb_data["upper_series"]) if v is not None]
    bb_middle = [{"time": date_strs[i], "value": v} for i, v in enumerate(bb_data["middle_series"]) if v is not None]
    bb_lower = [{"time": date_strs[i], "value": v} for i, v in enumerate(bb_data["lower_series"]) if v is not None]

    return {
        "candles": candles,
        "ema_lines": ema_lines,
        "rsi_series": rsi_series,
        "macd": {
            "macd_series": macd_series,
            "signal_series": signal_series,
            "histogram_series": hist_series,
        },
        "bollinger": {
            "upper": bb_upper,
            "middle": bb_middle,
            "lower": bb_lower,
        },
    }
