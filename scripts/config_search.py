import sys
import os

# Add the project root to the python path so we can import modernized_backend
sys.path.append(os.getcwd())

from modernized_backend.core.search import client

def configure_index():
    index_name = "securities"
    print(f"Configuring index: {index_name}...")

    # Create index if it doesn't exist (get_or_create_index is deprecated in some versions, but create_index is standard)
    # Actually, create_index raises error if exists. get_index raises if not.
    # The simplest way is to try to get it, or create it.
    try:
        index = client.get_index(index_name)
    except Exception:
        print(f"Index {index_name} not found. Creating...")
        client.create_index(index_name, {'primaryKey': 'ticker'})
        index = client.index(index_name)

    # 1. Update Ranking Rules - Exactness at the top
    # Default rules: ["words", "typo", "proximity", "attribute", "sort", "exactness"]
    # We want "exactness" at the top.
    ranking_rules = [
        "exactness",
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort"
    ]

    print("Updating ranking rules...")
    task = index.update_ranking_rules(ranking_rules)
    client.wait_for_task(task.task_uid)
    print("Ranking rules updated.")

    # 2. Update Typo Tolerance
    # Disable for symbol (ticker), keep for company_name (name)
    print("Updating typo tolerance...")
    typo_tolerance = {
        "enabled": True,
        "disableOnAttributes": ["ticker", "symbol"] # 'ticker' is the key, but 'symbol' was mentioned in prompt.
                                                   # I'll use 'ticker' as attribute name in meili, but prompt said "symbol attribute".
                                                   # I will map 'ticker' db column to 'symbol' or just disable on 'ticker' if I use that.
                                                   # Let's see sync script. I'll use 'ticker' as the ID and maybe 'symbol' as a field?
                                                   # Standard is usually 'ticker' or 'symbol'. I'll disable for both to be safe.
    }

    task = index.update_typo_tolerance(typo_tolerance)
    client.wait_for_task(task.task_uid)
    print("Typo tolerance updated.")

    # 3. Searchable Attributes (Optional but good practice)
    # We want to search by ticker and name.
    print("Updating searchable attributes...")
    searchable_attributes = ["ticker", "name"]
    task = index.update_searchable_attributes(searchable_attributes)
    client.wait_for_task(task.task_uid)
    print("Searchable attributes updated.")

    print("Configuration complete.")

if __name__ == "__main__":
    configure_index()
