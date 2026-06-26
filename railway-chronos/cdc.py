"""
cdc.py — CDC Wave 3 logic (Python)
ต้องตรงกับ src/lib/cdc.ts + buildSignal.ts ใน frontend
รวม tranche lot + stop loss + transaction cost + tuner
"""
import numpy as np
import pandas as pd

STOP_LOSS_PCT = 8
TXN_COST_PCT = 0.15

ZONE_LABELS = ["Neutral", "Strong Buy", "Buy", "Near Buy", "Near Sell", "Sell", "Strong Sell"]

FAST_GRID = [8, 10, 12, 15]
SLOW_GRID = [21, 26, 34]
WAVE_GRID = [50, 55, 89]


def calc_ema(prices: list, period: int) -> list:
    k = 2 / (period + 1)
    ema = [prices[0]]
    for i in range(1, len(prices)):
        ema.append(prices[i] * k + ema[i - 1] * (1 - k))
    return ema


def get_zone(p, e12, e26) -> int:
    if p > e12 > e26: return 1
    if p > e26 > e12: return 2
    if e12 > p > e26: return 3
    if e26 > p > e12: return 4
    if e12 > e26 > p: return 5
    if e26 > e12 > p: return 6
    return 0


def detect_waves(prices, ema12, ema26, ema55) -> list:
    stages = []
    had_w1 = had_w2 = prev_above = False
    for i in range(len(prices)):
        zone = get_zone(prices[i], ema12[i], ema26[i])
        above = ema12[i] > ema26[i]
        spread = ema12[i] - ema26[i]
        wave_spread = ema26[i] - ema55[i]
        if zone == 1 and above and not prev_above:
            stages.append("W1"); had_w1 = True; had_w2 = False
        elif zone in (3, 4) and above and had_w1:
            stages.append("W2"); had_w2 = True
        elif zone == 1 and above and had_w1 and had_w2 and spread > wave_spread * 0.5:
            stages.append("W3"); had_w2 = False
        elif zone in (5, 6):
            stages.append("SELL"); had_w1 = had_w2 = False
        else:
            stages.append("HOLD")
        prev_above = above
    return stages


def simulate(prices, waves) -> list:
    """tranche + stop loss + cost — ตรงกับ tuner.ts"""
    gains = []
    open_lots = []

    def close_all(exit_price):
        nonlocal open_lots
        for lot in open_lots:
            raw = (exit_price - lot) / lot * 100
            gains.append(round(raw - TXN_COST_PCT * 2, 4))
        open_lots = []

    for i in range(1, len(waves)):
        w, prev, price = waves[i], waves[i - 1], prices[i]
        if open_lots:
            worst = max(open_lots)
            if price < worst * (1 - STOP_LOSS_PCT / 100):
                close_all(price); continue
        if w == "W1" and prev != "W1" and len(open_lots) == 0:
            open_lots.append(price)
        elif w == "W2" and prev != "W2" and len(open_lots) == 1:
            open_lots.append(price)
        elif w == "W3" and prev != "W3" and len(open_lots) == 2:
            open_lots.append(price)
        elif w == "SELL" and prev != "SELL" and open_lots:
            close_all(price)
    if open_lots:
        close_all(prices[-1])
    return gains


def stats_of(gains):
    if not gains:
        return {"winRate": 0, "netProfit": 0, "mdd": 0}
    wins = sum(1 for g in gains if g > 0)
    eq = peak = 1.0
    mdd = 0.0
    for g in gains:
        eq *= 1 + g / 100
        if eq > peak: peak = eq
        dd = (eq - peak) / peak * 100
        if dd < mdd: mdd = dd
    return {
        "winRate": round(wins / len(gains) * 100),
        "netProfit": round((eq - 1) * 100, 2),
        "mdd": round(mdd, 2),
    }


def score_fn(s, trades):
    if not trades:
        return -np.inf
    penalty = 0.5 if trades < 5 else 1.0
    return (s["netProfit"] * (s["winRate"] / 100)) / (1 + abs(s["mdd"]) / 20) * penalty


def tune_params(dates, prices):
    n = len(prices)
    if n < 120:
        ema12 = calc_ema(prices, 12)
        ema26 = calc_ema(prices, 26)
        ema55 = calc_ema(prices, 55)
        waves = detect_waves(prices, ema12, ema26, ema55)
        g = simulate(prices, waves)
        s = stats_of(g)
        return {"fast": 12, "slow": 26, "wave": 55,
                "winRate": s["winRate"], "totalReturn": s["netProfit"],
                "mdd": s["mdd"], "trades": len(g), "oosWinRate": 0, "oosReturn": 0}

    year_of = [int(d[:4]) for d in dates]
    cutoff = int(n * 0.66)
    in_prices = prices[:cutoff]
    out_prices = prices[cutoff:]

    best = {"params": (12, 26, 55), "sc": -np.inf, "trades": 0}
    for fast in FAST_GRID:
        for slow in SLOW_GRID:
            if slow <= fast: continue
            for wave in WAVE_GRID:
                if wave <= slow: continue
                e12 = calc_ema(in_prices, fast)
                e26 = calc_ema(in_prices, slow)
                e55 = calc_ema(in_prices, wave)
                wv = detect_waves(in_prices, e12, e26, e55)
                g = simulate(in_prices, wv)
                s = stats_of(g)
                sc = score_fn(s, len(g))
                if sc > best["sc"]:
                    best = {"params": (fast, slow, wave), "sc": sc, "trades": len(g)}

    fast, slow, wave = best["params"]
    # out-of-sample
    oos_wr = oos_ret = 0
    if len(out_prices) >= 30:
        e12 = calc_ema(out_prices, fast)
        e26 = calc_ema(out_prices, slow)
        e55 = calc_ema(out_prices, wave)
        wv = detect_waves(out_prices, e12, e26, e55)
        oos_s = stats_of(simulate(out_prices, wv))
        oos_wr, oos_ret = oos_s["winRate"], oos_s["netProfit"]

    # full series
    e12 = calc_ema(prices, fast)
    e26 = calc_ema(prices, slow)
    e55 = calc_ema(prices, wave)
    wv = detect_waves(prices, e12, e26, e55)
    full_s = stats_of(simulate(prices, wv))

    return {"fast": fast, "slow": slow, "wave": wave,
            "winRate": full_s["winRate"], "totalReturn": full_s["netProfit"],
            "mdd": full_s["mdd"], "trades": len(simulate(prices, wv)),
            "oosWinRate": oos_wr, "oosReturn": oos_ret}


def build_trades(dates, prices, waves):
    trades = []
    open_lots = []

    def close_all(exit_idx, reason):
        nonlocal open_lots
        for lot in open_lots:
            raw = (prices[exit_idx] - lot["price"]) / lot["price"] * 100
            gain = raw - TXN_COST_PCT * 2
            bh = (prices[exit_idx] - prices[0]) / prices[0] * 100
            trades.append({
                "lot": lot["label"], "buyDate": dates[lot["idx"]],
                "buyPrice": round(lot["price"], 2), "sellDate": dates[exit_idx],
                "sellPrice": round(prices[exit_idx], 2), "status": "Closed",
                "signalGain": round(gain, 2), "bh": round(bh, 2), "exitReason": reason,
            })
        open_lots = []

    for i in range(1, len(waves)):
        w, prev, price = waves[i], waves[i - 1], prices[i]
        if open_lots:
            worst = max(open_lots, key=lambda x: x["price"])
            if price < worst["price"] * (1 - STOP_LOSS_PCT / 100):
                close_all(i, "stop"); continue
        if w == "W1" and prev != "W1" and len(open_lots) == 0:
            open_lots.append({"idx": i, "price": price, "label": "1/3"})
        elif w == "W2" and prev != "W2" and len(open_lots) == 1:
            open_lots.append({"idx": i, "price": price, "label": "2/3"})
        elif w == "W3" and prev != "W3" and len(open_lots) == 2:
            open_lots.append({"idx": i, "price": price, "label": "3/3"})
        elif w == "SELL" and prev != "SELL" and open_lots:
            close_all(i, "sell")

    last = len(prices) - 1
    for lot in open_lots:
        raw = (prices[last] - lot["price"]) / lot["price"] * 100
        bh = (prices[last] - prices[0]) / prices[0] * 100
        trades.append({
            "lot": lot["label"], "buyDate": dates[lot["idx"]],
            "buyPrice": round(lot["price"], 2), "sellDate": None,
            "sellPrice": None, "status": "Open",
            "signalGain": round(raw - TXN_COST_PCT, 2), "bh": round(bh, 2),
            "exitReason": None,
        })
    return trades


def calc_wave_phase(prices, waves) -> int:
    try:
        w3_start = len(waves) - 1 - waves[::-1].index("W3")
    except ValueError:
        return 0
    w1_start = -1
    for i in range(w3_start - 1, -1, -1):
        if waves[i] == "W1":
            w1_start = i; break
    if w1_start < 0: return 0
    try:
        w1_end = waves.index("W2", w1_start)
    except ValueError:
        return 0
    if w1_end > w3_start: return 0
    w1_slice = prices[w1_start:w1_end]
    if not w1_slice: return 0
    w1_range = max(w1_slice) - min(w1_slice)
    if w1_range == 0: return 0
    gain = prices[-1] - prices[w3_start]
    return min(100, max(0, round(gain / w1_range * 100)))


def build_signal_dict(ticker, name, df: pd.DataFrame) -> dict:
    dates = [str(d.date()) for d in df.index]
    prices = df["close"].round(2).tolist()
    volumes = df["volume"].astype(int).tolist()

    bt = tune_params(dates, prices)
    fast, slow, wave_p = bt["fast"], bt["slow"], bt["wave"]

    ema12s = calc_ema(prices, fast)
    ema26s = calc_ema(prices, slow)
    ema55s = calc_ema(prices, wave_p)
    waves = detect_waves(prices, ema12s, ema26s, ema55s)

    last = len(prices) - 1
    price = prices[last]
    zone = get_zone(price, ema12s[last], ema26s[last])
    wave = waves[last]

    action = "WAIT"
    if wave in ("W1", "W3"): action = "BUY"
    elif wave == "SELL": action = "SELL"
    elif wave == "W2": action = "WATCH"
    elif wave == "HOLD" and ema12s[last] > ema26s[last]: action = "WATCH"

    trades = build_trades(dates, prices, waves)
    signal_gain = sum(t["signalGain"] for t in trades if t["status"] == "Closed")
    wave_phase = calc_wave_phase(prices, waves)

    return {
        "ticker": ticker, "name": name, "date": dates[last],
        "price": round(price, 2),
        "ema12": round(ema12s[last], 2), "ema26": round(ema26s[last], 2),
        "ema55": round(ema55s[last], 2),
        "zone": zone, "zone_label": ZONE_LABELS[zone],
        "wave": wave, "action": action,
        "dates": dates, "prices": prices,
        "ema12s": [round(x, 2) for x in ema12s],
        "ema26s": [round(x, 2) for x in ema26s],
        "ema55s": [round(x, 2) for x in ema55s],
        "waves": waves, "volumes": volumes,
        "trades": trades, "signalGain": round(signal_gain, 2),
        "wavePhase": wave_phase,
        "backtest": {
            "params": {"fast": fast, "slow": slow, "wave": wave_p},
            "perYear": [], "totalReturn": bt["totalReturn"],
            "winRate": bt["winRate"], "mdd": bt["mdd"], "trades": bt["trades"],
            "oosWinRate": bt["oosWinRate"], "oosReturn": bt["oosReturn"],
        },
    }
