from meilisearch import Client
from .config import settings

client = Client(settings.MEILI_HOST, settings.MEILI_KEY)
