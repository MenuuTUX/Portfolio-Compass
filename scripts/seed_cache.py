import asyncio
import logging
import sys
import os
import requests
from io import StringIO
import pandas as pd
from tqdm.asyncio import tqdm
from typing import List

# Ensure modernized_backend is in python path
sys.path.append(os.getcwd())

from modernized_backend.services.market_data import fetch_stock_price_upstream

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_target_tickers() -> List[str]:
    """
    Returns a list of target tickers to seed the cache with.
    """
    targets = []

    # 1. S&P 500
    try:
        logger.info("Fetching S&P 500 tickers...")
        # Wikipedia table scraping with User-Agent to avoid 403
        url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        table = pd.read_html(StringIO(response.text))
        df = table[0]
        sp500_tickers = df['Symbol'].tolist()
        # Wikipedia uses dot for BRK.B, yfinance expects BRK-B
        sp500_tickers = [t.replace('.', '-') for t in sp500_tickers]
        targets.extend(sp500_tickers)
        logger.info(f"Added {len(sp500_tickers)} S&P 500 tickers.")
    except Exception as e:
        logger.error(f"Failed to fetch S&P 500 tickers: {e}")
        # Fallback to a few major ones if scraping fails
        targets.extend(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'])

    # 2. US ETFs (Top 50 by volume - hardcoded representative list)
    us_etfs = [
        "SPY", "QQQ", "IWM", "VTI", "VO", "VNQ", "GLD", "SLV", "ARKK", "IVV",
        "VOO", "VEA", "VWO", "IEFA", "AGG", "BND", "LQD", "VCIT", "VCSH", "BSV",
        "XLE", "XLF", "XLK", "XLV", "XLY", "XLP", "XLI", "XLU", "XLB", "XLRE",
        "DIA", "IJR", "IJH", "VUG", "VTV", "IWF", "IWD", "VIG", "VYM", "VNQ",
        "GDX", "EEM", "EFA", "TLT", "HYG", "JNK", "SHV", "BIL", "GOVT", "IEF"
    ]
    targets.extend(us_etfs)
    logger.info(f"Added {len(us_etfs)} US ETFs.")

    # 3. Canadian ETFs (Top 50 - hardcoded representative list with .TO suffix)
    ca_etfs = [
        "XIU.TO", "XIC.TO", "VFV.TO", "ZEB.TO", "VCN.TO", "XSP.TO", "XBB.TO", "XRE.TO", "HOU.TO", "HOD.TO",
        "HNU.TO", "HND.TO", "XEG.TO", "XFN.TO", "ZSP.TO", "ZAG.TO", "VDY.TO", "VCE.TO", "XEQT.TO", "VEQT.TO",
        "ZCN.TO", "XDIV.TO", "XGRO.TO", "VGRO.TO", "ZWB.TO", "ZWC.TO", "ZWU.TO", "HQU.TO", "HQD.TO", "HXT.TO",
        "HXU.TO", "HXD.TO", "HEU.TO", "HED.TO", "HGU.TO", "HGD.TO", "HBU.TO", "HBD.TO", "HUV.TO", "HVI.TO",
        "PSA.TO", "CASH.TO", "HSU.TO", "HSD.TO", "HXQ.TO", "ZQQ.TO", "XIT.TO", "XST.TO", "XUT.TO", "XTR.TO"
    ]
    targets.extend(ca_etfs)
    logger.info(f"Added {len(ca_etfs)} Canadian ETFs.")

    # Remove duplicates
    targets = list(set(targets))
    return targets

async def seed_ticker(sem: asyncio.Semaphore, ticker: str):
    async with sem:
        try:
            # We don't need the result, just calling it triggers the cache warming
            # thanks to @stale_while_revalidate decorator
            result = await fetch_stock_price_upstream(ticker)
            if result:
                 return True
            else:
                 return False
        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}")
            return False

async def main():
    logger.info("Starting Cache Warming Script...")

    target_tickers = get_target_tickers()
    logger.info(f"Total targets: {len(target_tickers)}")

    # Concurrency limit
    sem = asyncio.Semaphore(5)

    tasks = [seed_ticker(sem, ticker) for ticker in target_tickers]

    # Use tqdm for progress bar
    results = []
    for f in tqdm.as_completed(tasks, total=len(tasks), desc="Seeding Cache"):
        res = await f
        results.append(res)

    success_count = sum(results)
    logger.info(f"Cache warming complete. {success_count}/{len(target_tickers)} assets updated.")

if __name__ == "__main__":
    asyncio.run(main())
