"""
US Equities Stock Screener — FastAPI Backend v2
Run locally: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
import time
from typing import Optional

from screener import run_screen, format_results, get_chart_data
from db import init_db, save_scan_results, load_history
from ticker_list import TICKERS

app = FastAPI(title="US Equities Stock Screener API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scan_state = {
    "running": False,
    "progress": 0,
    "total": 0,
    "current_ticker": "",
    "results": [],
    "last_scan_time": None,
    "elapsed": None,
    "matched": 0,
}

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"status": "ok", "message": "Stock Screener API v2"}

@app.get("/api/tickers")
def get_tickers():
    return {"tickers": TICKERS, "count": len(TICKERS)}

@app.get("/api/scan/status")
def scan_status():
    return {
        "running": scan_state["running"],
        "progress": scan_state["progress"],
        "total": scan_state["total"],
        "current_ticker": scan_state["current_ticker"],
        "matched": scan_state["matched"],
        "last_scan_time": scan_state["last_scan_time"],
        "elapsed": scan_state["elapsed"],
    }

@app.get("/api/scan/results")
def scan_results():
    return {
        "results": scan_state["results"],
        "matched": scan_state["matched"],
        "last_scan_time": scan_state["last_scan_time"],
        "elapsed": scan_state["elapsed"],
    }

@app.post("/api/scan/start")
def start_scan(
    background_tasks: BackgroundTasks,
    max_pe: float = Query(50),
    min_vol_ratio: float = Query(2.0),
    min_rsi: float = Query(50),
    min_market_cap: float = Query(2.0),
    price_above_ema: bool = Query(True),
    pe_enabled: bool = Query(True),
    tickers: Optional[str] = Query(None),
):
    if scan_state["running"]:
        return {"status": "already_running"}
    filters = {
        "pe_enabled": pe_enabled,
        "max_pe": max_pe,
        "min_vol_ratio": min_vol_ratio,
        "min_rsi": min_rsi,
        "min_market_cap": min_market_cap,
        "price_above_ema": price_above_ema,
    }
    ticker_list = TICKERS
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    background_tasks.add_task(_run_scan_task, ticker_list, filters)
    return {"status": "started", "total": len(ticker_list)}

def _progress_callback(current, total, ticker):
    scan_state["progress"] = current
    scan_state["total"] = total
    scan_state["current_ticker"] = ticker

def _run_scan_task(ticker_list, filters):
    scan_state["running"] = True
    scan_state["progress"] = 0
    scan_state["results"] = []
    scan_state["matched"] = 0
    start = time.time()
    try:
        results = run_screen(ticker_list, filters, progress_callback=_progress_callback)
        formatted = format_results(results)
        scan_state["results"] = formatted
        scan_state["matched"] = len(formatted)
        scan_state["last_scan_time"] = time.strftime("%Y-%m-%d %H:%M:%S")
        scan_state["elapsed"] = round(time.time() - start, 1)
        if results:
            save_scan_results(results)
    except Exception as e:
        print(f"Scan error: {e}")
    finally:
        scan_state["running"] = False

@app.get("/api/chart/{ticker}")
def get_ticker_chart(ticker: str):
    data = get_chart_data(ticker.upper())
    if not data:
        return {"error": f"No data found for {ticker}"}
    return {"ticker": ticker.upper(), "chart": data}

@app.get("/api/history")
def get_history(days: int = Query(7)):
    return {"history": load_history(days=days)}

@app.get("/api/history/{ticker}")
def get_ticker_history(ticker: str, days: int = Query(30)):
    all_history = load_history(days=days)
    ticker_history = [h for h in all_history if h.get("ticker", "").upper() == ticker.upper()]
    return {"ticker": ticker.upper(), "history": ticker_history}
