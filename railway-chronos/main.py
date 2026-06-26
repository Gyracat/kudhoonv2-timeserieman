"""
main.py — CDC Wave 3 + Chronos-Bolt API for Railway
รับ ticker → ดึง Yahoo → คำนวณ CDC → Chronos-Bolt forecast → ส่ง JSON
ตรงกับ Signal type ใน frontend
"""
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import yfinance as yf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from cdc import build_signal_dict
from chronos_model import load_pipeline, chronos_confirm

_executor = ThreadPoolExecutor(max_workers=10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # โหลด Chronos model ครั้งเดียวตอน start
    print("Loading Chronos-Bolt...")
    load_pipeline()
    print("Chronos-Bolt ready")
    yield


app = FastAPI(title="CDC Wave 3 + Chronos API", lifespan=lifespan)

# CORS — Lovable ต้องเรียกได้
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _fetch_and_build(ticker: str) -> dict | None:
    """ดึง Yahoo + คำนวณ CDC + Chronos (sync, รันใน thread)"""
    try:
        df = yf.Ticker(ticker).history(period="3y", interval="1d")
        if df.empty or len(df) < 120:
            return None

        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df.index = pd.to_datetime(df.index).tz_localize(None)

        info = yf.Ticker(ticker).fast_info
        name = getattr(info, "display_name", None) or ticker

        # CDC signal (EMA, zone, wave, trades, backtest)
        signal = build_signal_dict(ticker, name, df)

        # Chronos-Bolt confirmation (volatility, direction, quantiles)
        chronos = chronos_confirm(
            prices=signal["prices"],
            ema12=signal["ema12s"],
            ema26=signal["ema26s"],
            volumes=signal["volumes"],
            cdc_action=signal["action"],
            cdc_zone=signal["zone"],
            cdc_wave=signal["wave"],
        )
        signal.update(chronos)
        return signal
    except Exception as e:
        print(f"[{ticker}] error: {e}")
        return None


async def _build_async(ticker: str) -> dict | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _fetch_and_build, ticker)


@app.get("/health")
async def health():
    return {"status": "ok", "model": "chronos-bolt-small"}


@app.get("/signal/{ticker}")
async def get_signal(ticker: str):
    result = await _build_async(ticker.upper())
    if result is None:
        raise HTTPException(404, f"No data for {ticker}")
    return result


@app.get("/signals")
async def get_signals(tickers: str = "", filter: str = "all"):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        return []

    results = await asyncio.gather(*[_build_async(t) for t in ticker_list])
    signals = [r for r in results if r is not None]

    # filter
    f = filter.lower()
    if f == "buy":
        signals = [s for s in signals if s["action"] == "BUY"]
    elif f == "sell":
        signals = [s for s in signals if s["action"] == "SELL"]
    elif f == "up":
        signals = [s for s in signals if s["ema12"] > s["ema26"]]
    elif f in ("w1", "w2", "w3"):
        signals = [s for s in signals if s["wave"] == f.upper()]

    return signals


@app.get("/search")
async def search(q: str = ""):
    """Yahoo Finance ticker search proxy"""
    if not q.strip():
        return {"results": []}
    import requests

    try:
        r = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 8, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8,
        )
        quotes = r.json().get("quotes", [])
        results = [
            {
                "ticker": qt.get("symbol", ""),
                "name": qt.get("longname") or qt.get("shortname", ""),
                "type": qt.get("quoteType", ""),
                "exchange": qt.get("exchDisp", ""),
            }
            for qt in quotes
            if qt.get("quoteType") in ("EQUITY", "ETF", "CRYPTOCURRENCY", "INDEX")
        ]
        return {"results": results}
    except Exception:
        return {"results": []}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
