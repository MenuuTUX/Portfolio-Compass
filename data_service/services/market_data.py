import asyncio
import logging
import yfinance as yf
from typing import Dict, Any, Optional
from data_service.core.cache import stale_while_revalidate

logger = logging.getLogger(__name__)

@stale_while_revalidate(ttl=60, grace_period=3600)
async def fetch_stock_price_upstream(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Fetches detailed market data for a given ticker from upstream (Yahoo Finance).

    Returns a dictionary containing:
    - price: Current price
    - yield: Dividend Yield
    - pe: PE Ratio
    - sector: Sector
    """
    try:
        def _fetch():
            ticker_obj = yf.Ticker(ticker)
            info = ticker_obj.info
            fast_info = ticker_obj.fast_info

            # Extract required fields
            # Price: prefer fast_info.last_price, fall back to info['currentPrice'] or 'regularMarketPrice'
            price = None
            if hasattr(fast_info, 'last_price') and fast_info.last_price:
                price = fast_info.last_price
            elif 'currentPrice' in info and info['currentPrice']:
                price = info['currentPrice']
            elif 'regularMarketPrice' in info and info['regularMarketPrice']:
                price = info['regularMarketPrice']

            dividend_yield = info.get('dividendYield')
            pe_ratio = info.get('trailingPE') or info.get('forwardPE')
            sector = info.get('sector')

            if price is None:
                # Try history as last resort
                hist = ticker_obj.history(period="1d")
                if not hist.empty:
                    price = hist['Close'].iloc[-1]

            return {
                "price": price,
                "yield": dividend_yield,
                "pe": pe_ratio,
                "sector": sector
            }

        data = await asyncio.to_thread(_fetch)

        if data["price"] is None:
            logger.warning(f"Could not fetch price for {ticker}")
            return None

        return data

    except Exception as e:
        logger.error(f"Error fetching upstream data for {ticker}: {e}")
        return None
