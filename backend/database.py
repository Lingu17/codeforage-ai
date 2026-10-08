import os
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from supabase.lib.client_options import SyncClientOptions
import config  # Load backend-local environment before reading settings.

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

def get_supabase_client(token: Optional[str] = None) -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials not found in environment variables.")
    client = create_client(SUPABASE_URL, SUPABASE_KEY, options=SyncClientOptions(
        auto_refresh_token=False, persist_session=False, postgrest_client_timeout=30,
    ))
    if token:
        client.postgrest.auth(token)
    return client


def get_contact_client() -> Client:
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not key:
        raise RuntimeError('Contact submission is not configured')
    return create_client(SUPABASE_URL, key, options=SyncClientOptions(
        auto_refresh_token=False, persist_session=False, postgrest_client_timeout=15,
    ))
