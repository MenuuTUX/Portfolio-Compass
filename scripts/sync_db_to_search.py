import sys
import os
import psycopg2
import time
from typing import List, Dict, Any
from urllib.parse import urlparse

# Add project root to path
sys.path.append(os.getcwd())

from modernized_backend.core.search import client
from modernized_backend.core.config import settings

BATCH_SIZE = 2000

def fetch_data():
    """Fetch data from Postgres."""
    print("Connecting to database...")

    # Handle schema parameter which psycopg2 might not like if passed directly in DSN string
    # or just use the raw URL if it works, but usually stripping query params is safer for basic psycopg2 connect
    db_url = settings.DATABASE_URL
    if "?" in db_url:
        db_url = db_url.split("?")[0]

    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        print(f"Failed to connect to DB: {e}")
        # If connection fails, maybe due to missing user/pass in clean URL, try original if it was different
        # But usually standard Postgres URL format is fine.
        raise e

    cur = conn.cursor()

    print("Fetching data...")
    # Check for table existence (Etf or etf)
    # We try both case sensitive and insensitive
    query = 'SELECT ticker, name, "assetType" FROM "Etf"'
    try:
        cur.execute(query)
    except psycopg2.errors.UndefinedTable:
        conn.rollback()
        print('Table "Etf" not found. Trying "etf"...')
        query = 'SELECT ticker, name, "assetType" FROM etf'
        cur.execute(query)
    except Exception as e:
        conn.rollback()
        print(f"Error executing query: {e}")
        raise e

    rows = cur.fetchall()
    print(f"Fetched {len(rows)} records.")

    documents = []
    for row in rows:
        ticker, name, asset_type = row
        documents.append({
            "ticker": ticker,
            "symbol": ticker, # duplicate for "symbol" attribute compatibility
            "name": name,
            "assetType": asset_type
        })

    cur.close()
    conn.close()
    return documents

def sync_to_meilisearch(documents: List[Dict[str, Any]]):
    index_name = "securities"
    index = client.index(index_name)

    print(f"Pushing {len(documents)} documents to Meilisearch in batches of {BATCH_SIZE}...")

    total_batches = (len(documents) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(documents), BATCH_SIZE):
        batch = documents[i : i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        print(f"Sending batch {batch_num}/{total_batches} ({len(batch)} docs)...")

        try:
            task = index.add_documents(batch, primary_key='ticker')
            print(f"Batch {batch_num} sent. Task UID: {task.task_uid}")
        except Exception as e:
            print(f"Error sending batch {batch_num}: {e}")

    print("All batches sent.")

if __name__ == "__main__":
    try:
        docs = fetch_data()
        sync_to_meilisearch(docs)
    except Exception as e:
        print(f"Script failed: {e}")
        sys.exit(1)
