from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from typing import List, Dict
import json

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def upsert_properties(properties: List[Dict]) -> None:
    """
    Upsert properties into Supabase.
    Handles deduplication by name/city/state combination.
    """
    if not properties:
        print('No properties to upsert')
        return

    print(f'Upserting {len(properties)} properties...')

    try:
        response = supabase.table('properties').upsert(
            properties,
            on_conflict='id',  # This will insert new or update existing
        ).execute()

        print(f'✓ Successfully upserted {len(properties)} properties')
        return response
    except Exception as e:
        print(f'✗ Error upserting properties: {e}')
        raise


def get_all_properties() -> List[Dict]:
    """
    Retrieve all properties from database.
    """
    try:
        response = supabase.table('properties').select('*').execute()
        return response.data
    except Exception as e:
        print(f'✗ Error fetching properties: {e}')
        return []


def delete_all_properties() -> None:
    """
    Delete all properties from database (for testing).
    """
    try:
        supabase.table('properties').delete().neq('id', 'NULL').execute()
        print('✓ Deleted all properties')
    except Exception as e:
        print(f'✗ Error deleting properties: {e}')
