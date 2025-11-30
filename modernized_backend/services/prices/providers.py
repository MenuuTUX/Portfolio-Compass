from abc import ABC, abstractmethod
import asyncio
import logging
import random
from typing import Optional
import httpx
import yfinance as yf

# Configure logging
logger = logging.getLogger(__name__)

class PriceProvider(ABC):
    """Abstract base class for price providers."""

    @abstractmethod
    async def get_price(self, ticker: str) -> Optional[float]:
        """Fetches the current price for a given ticker."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Returns the name of the provider."""
        pass

class YahooProvider(PriceProvider):
    @property
    def name(self) -> str:
        return "Yahoo Finance"

    async def get_price(self, ticker: str) -> Optional[float]:
        try:
            # yfinance is synchronous, so run it in a thread pool
            def _fetch():
                ticker_obj = yf.Ticker(ticker)
                # fast_info is usually faster for current price
                if hasattr(ticker_obj, 'fast_info'):
                     price = ticker_obj.fast_info.last_price
                     return price
                else:
                    # Fallback
                    data = ticker_obj.history(period="1d")
                    if not data.empty:
                        return data['Close'].iloc[-1]
                    return None

            price = await asyncio.to_thread(_fetch)
            return price
        except Exception as e:
            logger.error(f"Error fetching from Yahoo for {ticker}: {e}")
            return None

class AlphaVantageProvider(PriceProvider):
    def __init__(self, api_key: str = "DEMO"):
        self.api_key = api_key

    @property
    def name(self) -> str:
        return "AlphaVantage"

    async def get_price(self, ticker: str) -> Optional[float]:
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": ticker,
            "apikey": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                # Check for rate limit or error
                if "Note" in data:
                    logger.warning(f"AlphaVantage rate limit: {data['Note']}")
                    return None

                quote = data.get("Global Quote", {})
                price_str = quote.get("05. price")

                if price_str:
                    return float(price_str)
                return None
        except Exception as e:
            logger.error(f"Error fetching from AlphaVantage for {ticker}: {e}")
            return None

class MockProvider(PriceProvider):
    @property
    def name(self) -> str:
        return "Mock Provider"

    async def get_price(self, ticker: str) -> Optional[float]:
        # Simulate a slight delay and return a random price close to a 'real' one
        # For simplicity, we'll just return a random number around 100-200
        # unless we want to control it for testing.
        await asyncio.sleep(0.1)
        base_price = 150.0
        # Random deviation
        price = base_price + random.uniform(-5, 5)
        return price
