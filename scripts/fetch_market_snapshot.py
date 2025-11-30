import sys
import yfinance as yf
import json
import numpy as np

def to_py_float(val):
    if val is None:
        return 0.0
    if isinstance(val, (np.floating, np.integer)):
        return float(val)
    return float(val)

def fetch_snapshot(tickers):
    results = []
    # yfinance allows fetching multiple tickers at once
    # However, for robustness and custom handling, we might iterate or use Tickers
    # Let's use Tickers for batch if possible, but individual is safer for error handling per ticker in this context
    # unless we want speed. The user mentioned "via a lightweight Python shell call or batch fetch".
    # yf.Tickers("MSFT AAPL").tickers is a dict.

    # Process comma separated string
    if isinstance(tickers, str):
        tickers_list = tickers.split(',')
    else:
        tickers_list = tickers

    tickers_list = [t.strip().upper() for t in tickers_list if t.strip()]

    if not tickers_list:
        print("[]")
        return

    # Use Tickers for batch fetching to be fast
    try:
        data = yf.Tickers(" ".join(tickers_list))

        for ticker in tickers_list:
            try:
                # Access info. Note: calling info on each might be slow if not cached by yfinance batch
                # But yf.Tickers usually lazy loads.
                # Actually, for "Instant", we need current price.
                # data.tickers[ticker].info fetches.

                # Optimized approach: fast_info if available or regular info
                t_obj = data.tickers[ticker]

                # Check regular info
                info = t_obj.info

                # Basic validation
                if not info:
                    # Try .TO for Canadian market if it looks like a Canadian ticker or fails
                     # (Logic from old fetch_prices.py could be reused but we want "Fast Seed")
                    # For now, stick to provided tickers. The caller (TS script) should handle suffix if needed or we do it here.
                    # Let's keep it simple: fetch what is asked.
                    continue

                price_raw = info.get("currentPrice", info.get("regularMarketPreviousClose", 0.0))
                daily_change_raw = info.get("regularMarketChangePercent", 0.0)

                price = to_py_float(price_raw)
                daily_change = to_py_float(daily_change_raw) * 100

                name = info.get("shortName", ticker)
                quote_type = info.get("quoteType", "ETF")
                asset_type = "STOCK" if quote_type == "EQUITY" else "ETF"

                results.append({
                    "ticker": ticker,
                    "name": name,
                    "price": price,
                    "daily_change": daily_change,
                    "asset_type": asset_type
                })
            except Exception:
                # Ignore failures for snapshot
                continue

    except Exception as e:
        sys.stderr.write(f"Batch fetch error: {e}\n")

    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Join all args as they might be space separated
        input_tickers = " ".join(sys.argv[1:])
        # If comma separated
        if "," in input_tickers:
            t_list = input_tickers.split(",")
        else:
            t_list = input_tickers.split()

        fetch_snapshot(t_list)
    else:
        print("[]")
