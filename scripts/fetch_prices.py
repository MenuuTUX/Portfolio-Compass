import sys
import yfinance as yf
import json
import numpy as np

def to_py_float(val):
    """Safely convert numpy/pandas floats to python float."""
    if val is None:
        return 0.0
    if isinstance(val, (np.floating, np.integer)):
        return float(val)
    return float(val)

def get_ticker_data(ticker_symbol):
    """
    Tries to fetch data for ticker_symbol.
    If fails or empty info, tries appending '.TO' (Smart Fetch).
    Returns (ticker_obj, info_dict, success_symbol) or (None, None, None).
    """

    def fetch(symbol):
        t = yf.Ticker(symbol)
        try:
            # Accessing info triggers the fetch
            i = t.info
            # A good check is if we have a price or name.
            if not i or 'symbol' not in i or ('currentPrice' not in i and 'regularMarketPreviousClose' not in i):
                 return None, None
            return t, i
        except Exception:
            return None, None

    # Try original
    stock, info = fetch(ticker_symbol)
    if stock:
        return stock, info, ticker_symbol.upper()

    # Try with .TO if original didn't have suffix
    if not ticker_symbol.upper().endswith(".TO"):
        stock_to, info_to = fetch(ticker_symbol + ".TO")
        if stock_to:
            return stock_to, info_to, (ticker_symbol + ".TO").upper()

    return None, None, None


def fetch_and_store_etfs(tickers):
    results = []

    for ticker_input in tickers:
        try:
            # Smart Fetch
            stock, info, valid_ticker = get_ticker_data(ticker_input)

            if not stock:
                # Skip if not found
                continue

            ticker = valid_ticker

            # Extract basic info safely
            price_raw = info.get("currentPrice", info.get("regularMarketPreviousClose", 0.0))
            daily_change_raw = info.get("regularMarketChangePercent", 0.0)

            price = to_py_float(price_raw)
            daily_change = to_py_float(daily_change_raw) * 100

            yield_raw = info.get("yield", info.get("dividendYield", 0.0))
            yield_val = to_py_float(yield_raw) * 100 if yield_raw else 0.0

            mer_raw = info.get("annualReportExpenseRatio", 0.0)
            mer = to_py_float(mer_raw) * 100 if mer_raw else 0.0

            # --- Multi-Interval Fetching ---
            history_points = []

            # Helper to fetch and format history
            def fetch_history(period, interval, tag):
                hist = stock.history(period=period, interval=interval)
                for date, row in hist.iterrows():
                    # date is Timestamp
                    date_iso = date.isoformat()
                    close_val = to_py_float(row['Close'])
                    history_points.append({
                        "date": date_iso,
                        "close": close_val,
                        "interval": tag
                    })

            # 1 Day View: Fetch last 2 days with interval="60m" (tagged as interval: "1h")
            fetch_history(period="2d", interval="60m", tag="1h")

            # 1 Week View: Fetch last 5 days with interval="1d" (tagged as interval: "1d")
            fetch_history(period="5d", interval="1d", tag="1d")

            # 1 Month & 1 Year View: Fetch last 1 year with interval="1wk" (tagged as interval: "1wk")
            fetch_history(period="1y", interval="1wk", tag="1wk")

            # 5 Year View: Fetch last 5 years with interval="1mo" (tagged as interval: "1mo")
            fetch_history(period="5y", interval="1mo", tag="1mo")


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
            alloc_stocks = 100.0
            alloc_bonds = 0.0
            alloc_cash = 0.0
            cat = info.get("category", "").lower()
            if "bond" in cat or "fixed income" in cat:
                alloc_stocks = 0.0
                alloc_bonds = 100.0

            allocation = {
                "stocks_weight": alloc_stocks,
                "bonds_weight": alloc_bonds,
                "cash_weight": alloc_cash
            }

            etf_data = {
                "ticker": ticker,
                "name": str(info.get("shortName", ticker)),
                "currency": str(info.get("currency", "USD")),
                "exchange": str(info.get("exchange", "Unknown")),
                "price": price,
                "daily_change": daily_change,
                "yield": yield_val,
                "mer": mer,
                "history": history_points,
                "sectors": sectors,
                "allocation": allocation
            }
            results.append(etf_data)

        except Exception as e:
            # We silently fail individual tickers in JSON output or log to stderr
            sys.stderr.write(f"Error fetching {ticker_input}: {e}\n")
            continue

    # Print final JSON to stdout
    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        tickers_to_fetch = sys.argv[1:]
        if len(tickers_to_fetch) == 1 and "," in tickers_to_fetch[0]:
            tickers_to_fetch = tickers_to_fetch[0].split(",")
    else:
        tickers_to_fetch = []

    if tickers_to_fetch:
        fetch_and_store_etfs(tickers_to_fetch)
    else:
        print("[]")
