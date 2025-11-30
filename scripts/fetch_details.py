import sys
import yfinance as yf
import json
import numpy as np
from datetime import datetime, timedelta

def to_py_float(val):
    if val is None:
        return 0.0
    if isinstance(val, (np.floating, np.integer)):
        return float(val)
    return float(val)

def fetch_details(ticker_symbol):
    # Smart fetch logic (auto .TO) if needed?
    # The prompt says "Accept a single TICKER argument."
    # It doesn't explicitly say to do the .TO logic here, but the old one did.
    # To be robust, I should probably check if the ticker exists, or rely on the input being correct (from seed).
    # Since Seed used explicit tickers, we should be good.
    # But let's keep the retry logic just in case the user searches for "VFV" and we only have "VFV.TO" in DB?
    # No, the API receives the ticker from the frontend/DB.

    ticker = yf.Ticker(ticker_symbol)
    try:
        info = ticker.info
        # Basic check
        if not info or ('currentPrice' not in info and 'regularMarketPreviousClose' not in info):
             # Try adding .TO if not present
             if not ticker_symbol.upper().endswith(".TO"):
                 ticker_symbol_to = ticker_symbol + ".TO"
                 ticker = yf.Ticker(ticker_symbol_to)
                 info = ticker.info
                 if not info or ('currentPrice' not in info and 'regularMarketPreviousClose' not in info):
                     raise ValueError("Ticker not found")
                 ticker_symbol = ticker_symbol_to # Update symbol
             else:
                 raise ValueError("Ticker not found")
    except Exception as e:
        # If complete failure, return error json or empty
        print(json.dumps({"error": str(e)}))
        return

    # Basic Info
    price_raw = info.get("currentPrice", info.get("regularMarketPreviousClose", 0.0))
    daily_change_raw = info.get("regularMarketChangePercent", 0.0)
    yield_raw = info.get("yield", info.get("dividendYield", 0.0))
    mer_raw = info.get("annualReportExpenseRatio", 0.0)

    price = to_py_float(price_raw)
    daily_change = to_py_float(daily_change_raw) * 100
    yield_val = to_py_float(yield_raw) * 100 if yield_raw else 0.0
    mer = to_py_float(mer_raw) * 100 if mer_raw else 0.0

    currency = str(info.get("currency", "USD"))
    exchange = str(info.get("exchange", "Unknown"))
    name = str(info.get("shortName", ticker_symbol))
    quote_type = info.get("quoteType", "ETF")
    asset_type = "STOCK" if quote_type == "EQUITY" else "ETF"

    # History
    history_points = []

    def fetch_history_batch(period, interval, tag):
        try:
            hist = ticker.history(period=period, interval=interval)
            points = []
            for date, row in hist.iterrows():
                points.append({
                    "date": date.isoformat(),
                    "close": to_py_float(row['Close']),
                    "interval": tag
                })
            return points
        except Exception:
            return []

    # 1H: Last 5 days (interval: "60m") → Tag as 1h.
    h1 = fetch_history_batch("5d", "60m", "1h")

    # 1D: Last 1 month (interval: "1d") → Tag as 1d.
    h1d = fetch_history_batch("1mo", "1d", "1d")

    # 1W: Last 2 years (interval: "1wk") → Tag as 1wk.
    h1w = fetch_history_batch("2y", "1wk", "1wk")

    # 1M: Max history (interval: "1mo") → Tag as 1mo.
    h1m = fetch_history_batch("max", "1mo", "1mo")

    history_points = h1 + h1d + h1w + h1m

    # Sectors
    sectors = []
    sectors_data = info.get("sectorWeightings", [])
    if sectors_data and isinstance(sectors_data, list):
         for s in sectors_data:
             s_name = s.get('sector', 'Unknown')
             s_weight = to_py_float(s.get('weight', 0)) * 100
             if s_weight > 0:
                 sectors.append({"sector_name": s_name, "weight": s_weight})

    # Allocation
    # Simple logic from old script
    alloc_stocks = 100.0
    alloc_bonds = 0.0
    alloc_cash = 0.0
    cat = info.get("category", "").lower()
    if "bond" in cat or "fixed income" in cat:
        alloc_stocks = 0.0
        alloc_bonds = 100.0

    # Or try to parse 'assetClasses' if available? yfinance often doesn't give clean allocation data in .info
    # We stick to the old logic for consistency unless we find better data.

    allocation = {
        "stocks_weight": alloc_stocks,
        "bonds_weight": alloc_bonds,
        "cash_weight": alloc_cash
    }

    result = {
        "ticker": ticker_symbol,
        "name": name,
        "currency": currency,
        "exchange": exchange,
        "price": price,
        "daily_change": daily_change,
        "yield": yield_val,
        "mer": mer,
        "asset_type": asset_type,
        "history": history_points,
        "sectors": sectors,
        "allocation": allocation
    }

    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ticker_arg = sys.argv[1]
        fetch_details(ticker_arg)
    else:
        print(json.dumps({"error": "No ticker provided"}))
