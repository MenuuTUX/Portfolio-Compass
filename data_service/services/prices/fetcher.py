import asyncio
import logging
import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Tuple
from .providers import PriceProvider, YahooProvider, AlphaVantageProvider, MockProvider

logger = logging.getLogger(__name__)

def calculate_consensus_price(prices: List[float]) -> Tuple[Optional[float], List[int]]:
    """
    Calculates the consensus price using Z-Score to filter outliers.

    Args:
        prices: A list of float prices.

    Returns:
        A tuple containing:
        - The mean of the valid prices (or None).
        - A list of indices of the prices that were considered outliers.
    """
    if not prices:
        return None, []

    if len(prices) < 3:
        # Not enough data for Z-Score
        return sum(prices) / len(prices), []

    try:
        df = pd.DataFrame({'price': prices})

        if df['price'].std() == 0:
            return df['price'].iloc[0], []

        df['z_score'] = (df['price'] - df['price'].mean()) / df['price'].std()

        # Filter outliers: Z-Score > 1.5
        mask_valid = df['z_score'].abs() <= 1.5
        valid_prices = df[mask_valid]['price']
        outlier_indices = df[~mask_valid].index.tolist()

        if valid_prices.empty:
            logger.warning("All prices were considered outliers by Z-Score filter.")
            return None, df.index.tolist() # All are outliers

        return valid_prices.mean(), outlier_indices

    except Exception as e:
        logger.error(f"Error calculating consensus price: {e}")
        return None, []


class PriceFetcher:
    def __init__(self, providers: Optional[List[PriceProvider]] = None):
        if providers:
            self.providers = providers
        else:
            self.providers = [
                YahooProvider(),
                AlphaVantageProvider(),
                MockProvider()
            ]

    async def fetch_price(self, ticker: str) -> Optional[float]:
        """
        Queries all providers simultaneously and returns a consensus price.
        """
        tasks = [provider.get_price(ticker) for provider in self.providers]

        # return_exceptions=True allows us to handle failures gracefully
        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid_prices = []
        valid_indices = [] # Indices in the original providers list

        for i, result in enumerate(results):
            provider_name = self.providers[i].name
            if isinstance(result, Exception):
                logger.error(f"Provider {provider_name} failed: {result}")
            elif result is None:
                logger.warning(f"Provider {provider_name} returned no data.")
            else:
                valid_prices.append(result)
                valid_indices.append(i)

        if not valid_prices:
            logger.error(f"No prices fetched for {ticker}")
            return None

        consensus, outlier_local_indices = calculate_consensus_price(valid_prices)

        # Log suspected bad data sources
        for local_idx in outlier_local_indices:
            # Map back to original provider index
            provider_idx = valid_indices[local_idx]
            provider_name = self.providers[provider_idx].name
            logger.warning(f"Suspected Bad Data Source: {provider_name} returned outlier value {valid_prices[local_idx]}")

        return consensus
