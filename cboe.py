"""
CBOE Put/Call Ratio fetcher.
Uses CBOE's public daily market statistics endpoint.
"""

import requests
import pandas as pd
from datetime import datetime

CBOE_URL = "https://www.cboe.com/us/options/market_statistics/daily/"

_cached_data: dict = {}
_cache_timestamp: datetime = None
CACHE_TTL_SECONDS = 300  # 5 minutes


def _is_cache_valid() -> bool:
    if _cache_timestamp is None:
        return False
    delta = (datetime.now() - _cache_timestamp).total_seconds()
    return delta < CACHE_TTL_SECONDS


def fetch_cboe_put_call_ratios() -> dict:
    """
    Fetches equity put/call ratios from CBOE.
    Returns a dict of {ticker: put_call_ratio} or empty dict on failure.
    Note: CBOE provides index-level ratios, not per-ticker.
    We return the total equity P/C ratio for all tickers as a proxy.
    """
    global _cached_data, _cache_timestamp

    if _is_cache_valid() and _cached_data:
        return _cached_data

    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(CBOE_URL, headers=headers, timeout=10)
        response.raise_for_status()

        # Try to parse tables from the HTML
        tables = pd.read_html(response.text)
        for table in tables:
            table.columns = [str(c).strip().lower() for c in table.columns]
            # Look for a ratio column
            ratio_cols = [c for c in table.columns if "ratio" in c or "p/c" in c]
            if ratio_cols:
                # Get equity put/call ratio if available
                equity_rows = table[
                    table.apply(
                        lambda r: any("equity" in str(v).lower() for v in r), axis=1
                    )
                ]
                if not equity_rows.empty:
                    ratio_val = equity_rows.iloc[0][ratio_cols[0]]
                    try:
                        ratio = float(ratio_val)
                        _cached_data = {"__equity__": round(ratio, 3)}
                        _cache_timestamp = datetime.now()
                        return _cached_data
                    except (ValueError, TypeError):
                        pass

    except Exception:
        pass

    # Return empty on failure — callers should show N/A
    return {}


def get_put_call_ratio(ticker: str) -> str:
    """
    Returns put/call ratio string for a ticker.
    Since CBOE provides market-wide equity P/C ratio (not per ticker),
    we return the equity P/C ratio as a market-wide indicator for all tickers.
    """
    ratios = fetch_cboe_put_call_ratios()
    val = ratios.get("__equity__")
    if val is not None:
        return str(val)
    return "N/A"
