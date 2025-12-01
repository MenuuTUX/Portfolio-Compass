import sys
import yfinance as yf
import json
import numpy as np
import pandas as pd

def to_py_float(val):
    if val is None:
        return 0.0
    if isinstance(val, (np.floating, np.integer)):
        return float(val)
    return float(val)

import requests
import io

def get_sp500_tickers():
    try:
        url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        tables = pd.read_html(io.StringIO(response.text))
        df = None
        for table in tables:
            if 'Symbol' in table.columns:
                df = table
                break
        
        if df is None:
            sys.stderr.write("Could not find S&P 500 table with 'Symbol' column.\n")
            return []

        tickers = df['Symbol'].tolist()
        # Replace dots with dashes for yfinance (e.g. BRK.B -> BRK-B)
        tickers = [t.replace('.', '-') for t in tickers]
        return tickers
    except Exception as e:
        sys.stderr.write(f"Error fetching S&P 500 tickers: {e}\n")
        return []

def get_top_etfs():
    # Top 50 North American ETFs (Mix of US and Canada)
    # This is a curated list based on popularity and AUM
    return [
        # US Broad Market
        'SPY', 'IVV', 'VOO', 'VTI', 'QQQ', 'VEA', 'VTV', 'IEFA', 'BND', 'AGG',
        'VUG', 'VIG', 'IJR', 'IWF', 'VWO', 'IJH', 'VGT', 'XLK', 'IWM', 'GLD',
        # Canadian Broad Market (TSX)
        'XIU.TO', 'XIC.TO', 'VFV.TO', 'VUN.TO', 'XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO',
        'ZEB.TO', 'VDY.TO', 'ZSP.TO', 'HQU.TO', 'HOU.TO', 'HOD.TO', 'HNU.TO',
        'XIU.TO', 'ZAG.TO', 'XBB.TO', 'VAB.TO', 'XSP.TO',
        # Sector / Thematic
        'XLV', 'XLF', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLRE', 'XLU', 'SMH'
    ]

def fetch_snapshot(tickers):
    results = []
    
    if isinstance(tickers, str):
        tickers_list = tickers.split(',')
    else:
        tickers_list = tickers

    tickers_list = [t.strip().upper() for t in tickers_list if t.strip()]
    
    # Deduplicate
    tickers_list = list(set(tickers_list))

    if not tickers_list:
        print("[]")
        return

    # Use Tickers for batch fetching
    try:
        # yfinance handles batching efficiently
        # We process in chunks to avoid overwhelming if list is huge, though yfinance handles it well.
        # For 500+ tickers, one call is usually fine.
        
        # Note: yf.Tickers might not fetch info for all immediately.
        # Accessing .info triggers the fetch.
        
        # To speed up, we might want to use the Tickers object but we need to iterate.
        # There isn't a bulk "get all info" method that returns a dict of infos directly without iteration
        # in the standard public API, but accessing tickers.tickers[symbol].info works.
        
        data = yf.Tickers(" ".join(tickers_list))
        
        for ticker in tickers_list:
            try:
                t_obj = data.tickers[ticker]
                info = t_obj.info
                
                if not info:
                    continue

                price_raw = info.get("currentPrice", info.get("regularMarketPreviousClose", 0.0))
                daily_change_raw = info.get("regularMarketChangePercent", 0.0)
                
                price = to_py_float(price_raw)
                daily_change = to_py_float(daily_change_raw) * 100
                
                name = info.get("shortName", info.get("longName", ticker))
                quote_type = info.get("quoteType", "ETF")
                asset_type = "STOCK" if quote_type == "EQUITY" else "ETF"
                
                # Yield
                # dividendYield is usually a decimal (e.g. 0.015 for 1.5%)
                yield_raw = info.get("dividendYield", info.get("yield", 0.0))
                yield_val = to_py_float(yield_raw) * 100 if yield_raw else 0.0
                
                # MER (Expense Ratio)
                # annualReportExpenseRatio is often available for ETFs
                mer_raw = info.get("annualReportExpenseRatio", info.get("expenseRatio", None))
                # Sometimes it's None for stocks
                mer_val = to_py_float(mer_raw) * 100 if mer_raw is not None else 0.0
                # For stocks, MER is effectively 0, but let's keep it 0.0

                results.append({
                    "ticker": ticker,
                    "name": name,
                    "price": price,
                    "daily_change": daily_change,
                    "asset_type": asset_type,
                    "yield": yield_val,
                    "mer": mer_val
                })
            except Exception:
                continue

    except Exception as e:
        sys.stderr.write(f"Batch fetch error: {e}\n")

    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        
        if arg == "--get-tickers":
            sp500 = get_sp500_tickers()
            top_etfs = get_top_etfs()
            all_tickers = list(set(sp500 + top_etfs))
            print(json.dumps(all_tickers))
        else:
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
