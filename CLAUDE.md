# US Equities Stock Screener v2 — CLAUDE.md

## Architecture
- **Backend:** FastAPI (Python) → deployed on Render.com
- **Frontend:** Next.js 14 (React + TypeScript + Tailwind) → deployed on Vercel
- **Database:** SQLite (persistent via Render disk at /var/data)
- **Charts:** TradingView Lightweight Charts (candlestick + EMA + BB + RSI + MACD)

## Project Structure
```
screener-v2/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── screener.py      # Fetch, filter, rank pipeline
│   ├── indicators.py    # All technical indicators
│   ├── cboe.py          # CBOE put/call ratio
│   ├── db.py            # SQLite history (auto-detects /var/data on Render)
│   ├── ticker_list.py   # S&P 500 tickers
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main screener page
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── globals.css     # Design tokens + global styles
│   │   ├── components/
│   │   │   ├── StockRow.tsx            # Table row + expandable chart
│   │   │   ├── charts/
│   │   │   │   └── CandlestickChart.tsx # TradingView chart
│   │   │   └── ui/
│   │   │       └── ScoreBar.tsx         # Composite score bar
│   │   └── lib/
│   │       └── api.ts          # API helper functions
│   ├── package.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── tsconfig.json
├── render.yaml          # Render deployment config
├── vercel.json          # Vercel deployment config
├── .gitignore
└── CLAUDE.md

## Run Locally
### Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

### Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# Open http://localhost:3000

## Indicators
- EMA (9, 21, 200): pandas ewm()
- RSI (14): Wilder smoothing
- MACD (12,26,9): EMA diff + signal line + histogram + crossover
- Bollinger Bands (20, 2σ): %B and bandwidth
- ATR (14): Wilder smoothing, shown as % of price
- 52-Week High/Low: Rolling 252-bar max/min
- Volume Ratio: Current / 20-day average
- Composite Score: Vol 40% + RSI 30% + EMA position 20% + MACD 10%

## Composite Score Weights
Vol Ratio  → 40% (most actionable momentum signal)
RSI        → 30% (trend strength)
EMA pos    → 20% (trend direction)
MACD hist  → 10% (crossover momentum)

## Deployment Notes
- render.yaml sets rootDir=backend so Render runs from /backend
- vercel.json sets buildCommand to cd frontend && npm install && npm run build
- NEXT_PUBLIC_API_URL env var must be set in Vercel to point to Render URL
- allow_origins in main.py should be updated to your Vercel URL after deploy
