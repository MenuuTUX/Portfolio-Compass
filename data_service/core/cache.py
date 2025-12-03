import functools
import pickle
import base64
import time
import asyncio
import hashlib
import logging
from typing import Callable, Any, Optional

from data_service.core.redis_client import redis_client

logger = logging.getLogger(__name__)

def stale_while_revalidate(ttl: int, grace_period: int):
    """
    Decorator that implements the 'Stale-While-Revalidate' caching pattern.

    Args:
        ttl: Time to live in seconds. Data younger than this is considered fresh.
        grace_period: Time in seconds after TTL during which stale data can be served
                      while a background refresh is triggered.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate a consistent cache key
            # Using module, function name, and arguments
            key_content = f"{func.__module__}:{func.__name__}:{str(args)}:{str(kwargs)}"
            key_hash = hashlib.sha256(key_content.encode('utf-8')).hexdigest()
            cache_key = f"swr_cache:{key_hash}"

            now = time.time()
            cached_data = None

            # Try to fetch from Redis
            try:
                cached_str = await redis_client.get(cache_key)
                if cached_str:
                    # Deserialize: Base64 -> Bytes -> Pickle
                    cached_data = pickle.loads(base64.b64decode(cached_str))
            except Exception as e:
                logger.error(f"Redis get failed for key {cache_key}: {e}")
                # Fallback to direct execution if Redis fails

            # Function to fetch fresh data and update cache
            async def fetch_and_cache():
                try:
                    # Fetch data (this should raise if the actual function fails)
                    result = await func(*args, **kwargs)
                except Exception as e:
                    # If the function itself fails, we must let it bubble up
                    raise e

                # Try to cache the result
                try:
                    timestamp = time.time()
                    payload = (timestamp, result)
                    serialized = base64.b64encode(pickle.dumps(payload)).decode('utf-8')

                    # Store in Redis with expiration = ttl + grace_period
                    # We add a small buffer to ensure the key exists for the full grace period
                    expire_time = ttl + grace_period + 60
                    await redis_client.set(cache_key, serialized, ex=expire_time)
                except Exception as e:
                    # If Redis fails (serialization or connection), log it but don't fail the request
                    logger.error(f"Failed to cache result for key {cache_key}: {e}")

                return result

            # Logic Flow
            if cached_data:
                cached_ts, value = cached_data
                age = now - cached_ts

                if age < ttl:
                    # Hit (Fresh)
                    return value

                if age < (ttl + grace_period):
                    # Hit (Stale)
                    # Trigger background refresh
                    # Note: We create a task but don't await it
                    asyncio.create_task(fetch_and_cache())
                    return value

            # Miss or Expired (older than ttl + grace_period)
            # Fetch synchronously (await)
            return await fetch_and_cache()

        return wrapper
    return decorator
