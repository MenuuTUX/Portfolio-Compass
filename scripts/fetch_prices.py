import yfinance as yf
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

tickers = ['VFV.TO', 'XEQT.TO', 'ZAG.TO', 'VDY.TO']

# Static data to enrich the API response
STATIC_DATA = {
    'VFV.TO': {
        'metrics': {'mer': 0.09},
        'allocation': {'equities': 0.99, 'bonds': 0.00, 'cash': 0.01},
        'sectors': {'Technology': 0.29, 'Financials': 0.13, 'Other': 0.58}
    },
    'XEQT.TO': {
        'metrics': {'mer': 0.20},
        'allocation': {'equities': 0.99, 'bonds': 0.00, 'cash': 0.01},
        'sectors': {'Financials': 0.20, 'Technology': 0.15, 'Industrials': 0.12, 'Other': 0.53}
    },
    'ZAG.TO': {
        'metrics': {'mer': 0.09},
        'allocation': {'equities': 0.00, 'bonds': 0.99, 'cash': 0.01},
        'sectors': {'Government': 0.40, 'Corporate': 0.30, 'Securitized': 0.20, 'Other': 0.10}
    },
    'VDY.TO': {
        'metrics': {'mer': 0.22},
        'allocation': {'equities': 0.99, 'bonds': 0.00, 'cash': 0.01},
        'sectors': {'Financials': 0.56, 'Energy': 0.30, 'Utilities': 0.08, 'Other': 0.06}
    }
}

data = []

logging.info(f"Fetching data for {len(tickers)} tickers...")

for t in tickers:
    try:
        logging.info(f"Processing {t}...")
        stock = yf.Ticker(t)

        # 1. Get Price for the Day
        info = stock.info
        current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')

        if current_price is None:
            logging.warning(f"Could not find price for {t}, skipping.")
            continue

        # Get other info
        name = info.get('longName', t)

        # Calculate change percent manually to avoid confusion with API inconsistencies
        previous_close = info.get('regularMarketPreviousClose') or info.get('previousClose')
        change_percent = 0
        if previous_close and current_price:
            change = current_price - previous_close
            change_percent = (change / previous_close) * 100

        yield_val = info.get('dividendYield', 0) # e.g. 0.93

        # 2. Get Historic Price (1 Year, Weekly intervals to save space)
        # This gives us enough data for a "1Y Trend" chart without bloating the file
        hist = stock.history(period="1y", interval="1wk")
        history_points = hist['Close'].tolist()

        # Merge with static data
        static_info = STATIC_DATA.get(t, {})
        metrics = static_info.get('metrics', {}).copy() # Copy to avoid mutating static data

        # Update metrics with dynamic yield if available
        if yield_val is not None:
             metrics['yield'] = yield_val

        etf_data = {
            "ticker": t,
            "name": name,
            "price": round(current_price, 2),
            "changePercent": round(change_percent, 2),
            "history": [round(x, 2) for x in history_points],
            "metrics": metrics,
            "allocation": static_info.get('allocation', {}),
            "sectors": static_info.get('sectors', {})
        }

        data.append(etf_data)
        logging.info(f"Successfully processed {t}")

    except Exception as e:
        logging.error(f"Error processing {t}: {e}")

output_path = 'public/data/etfs.json'
logging.info(f"Writing data to {output_path}...")
with open(output_path, 'w') as f:
    json.dump(data, f, indent=2)

logging.info("Done.")
