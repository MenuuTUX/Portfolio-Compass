from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore other variables in .env like DATABASE_URL

settings = Settings()
