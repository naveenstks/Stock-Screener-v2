import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

_RENDER_DISK = Path("/var/data")
if _RENDER_DISK.exists():
    DB_PATH = _RENDER_DISK / "history.db"
else:
    DB_PATH = Path(__file__).parent / "data" / "history.db"


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scanned_at TEXT NOT NULL,
            ticker TEXT NOT NULL,
            exchange TEXT,
            sector TEXT,
            price REAL,
            pe REAL,
            market_cap_b REAL,
            vol_ratio REAL,
            ema_9 REAL,
            ema_21 REAL,
            ema_200 REAL,
            rsi REAL,
            macd REAL,
            macd_histogram REAL,
            macd_crossover TEXT,
            bb_upper REAL,
            bb_lower REAL,
            bb_pct_b REAL,
            atr REAL,
            atr_pct REAL,
            week_52_high REAL,
            week_52_low REAL,
            pct_from_52_high REAL,
            composite_score REAL,
            signal TEXT,
            next_earnings TEXT
        )
    """)
    conn.commit()
    conn.close()


def save_scan_results(results: list):
    if not results:
        return
    init_db()
    now = datetime.now().isoformat(timespec="seconds")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for r in results:
        cursor.execute("""
            INSERT INTO scan_results (
                scanned_at, ticker, exchange, sector, price, pe, market_cap_b,
                vol_ratio, ema_9, ema_21, ema_200, rsi,
                macd, macd_histogram, macd_crossover,
                bb_upper, bb_lower, bb_pct_b,
                atr, atr_pct, week_52_high, week_52_low, pct_from_52_high,
                composite_score, signal, next_earnings
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            now, r.get("ticker"), r.get("exchange"), r.get("sector"),
            r.get("price"), r.get("pe"), r.get("market_cap_b"),
            r.get("vol_ratio"), r.get("ema_9"), r.get("ema_21"), r.get("ema_200"),
            r.get("rsi"), r.get("macd"), r.get("macd_histogram"), r.get("macd_crossover"),
            r.get("bb_upper"), r.get("bb_lower"), r.get("bb_pct_b"),
            r.get("atr"), r.get("atr_pct"),
            r.get("week_52_high"), r.get("week_52_low"), r.get("pct_from_52_high"),
            r.get("composite_score"), r.get("signal"), r.get("next_earnings"),
        ))
    conn.commit()
    cutoff = (datetime.now() - timedelta(days=7)).isoformat()
    cursor.execute("DELETE FROM scan_results WHERE scanned_at < ?", (cutoff,))
    conn.commit()
    conn.close()


def load_history(days: int = 7) -> list:
    if not DB_PATH.exists():
        return []
    init_db()
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM scan_results WHERE scanned_at >= ? ORDER BY scanned_at DESC",
        (cutoff,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
