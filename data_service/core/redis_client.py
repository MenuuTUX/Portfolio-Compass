import redis.asyncio as redis
from data_service.core.config import settings

# Configure a ConnectionPool with a maximum of 20 connections and a timeout of 5 seconds
connection_pool = redis.ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    max_connections=20,
    socket_timeout=5,
    decode_responses=True
)

# Initialize an asynchronous Redis client
redis_client = redis.Redis(connection_pool=connection_pool)

async def check_cache_health() -> bool:
    """
    Checks if the Redis cache is reachable.

    Returns:
        bool: True if Redis is reachable, False otherwise.
    """
    try:
        # The ping method returns True (or a PONG response which evaluates to True) on success
        response = await redis_client.ping()
        return bool(response)
    except Exception:
        return False
