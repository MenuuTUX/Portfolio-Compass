from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    MEILI_HOST: str = "http://127.0.0.1:7700"
    MEILI_KEY: str = "masterKey"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public"

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore other variables in .env like DATABASE_URL

settings = Settings()
