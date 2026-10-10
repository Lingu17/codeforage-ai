"""Validate configuration without printing secret values."""
import os
import base64
import json
from urllib.parse import urlsplit
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).with_name('.env'))


def is_privileged_supabase_key(key):
    if key.startswith('sb_secret_'):
        return True
    try:
        payload = key.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        return isinstance(claims, dict) and claims.get('role') == 'service_role'
    except (IndexError, ValueError, UnicodeError):
        return False


def validate_public_supabase_key(key):
    if is_privileged_supabase_key(key or ''):
        raise RuntimeError('SUPABASE_ANON_KEY must be a public anon or publishable key')


def validate_config():
    validate_public_supabase_key(os.getenv('SUPABASE_ANON_KEY'))
    if os.getenv('APP_ENV', 'development') not in ('development', 'test', 'production'):
        raise RuntimeError('APP_ENV must be development, test, or production')
    if int(os.getenv('EMBED_DIM', '768')) != 768:
        raise RuntimeError('EMBED_DIM must match the database vector dimension (768)')
    for name, low, high, default in (
        ('EMBED_BATCH_SIZE', 1, 100, 16), ('EMBED_WORKERS', 1, 8, 2),
        ('EMBED_MAX_RETRIES', 0, 5, 3), ('EMBED_REQUESTS_PER_MINUTE', 1, 6000, 60),
        ('AI_TIMEOUT_SECONDS', 1, 120, 60),
    ):
        if not low <= int(os.getenv(name, str(default))) <= high:
            raise RuntimeError(f'{name} must be between {low} and {high}')
    if os.getenv('APP_ENV') == 'production':
        required = ('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GEMINI_API_KEY',
                    'GROQ_API_KEY', 'GROQ_MODEL', 'GEMINI_AI_MODEL', 'ALLOWED_ORIGINS')
        missing = [key for key in required if not os.getenv(key) or 'replace-with' in os.getenv(key, '')]
        if missing:
            raise RuntimeError('Missing production configuration: ' + ', '.join(missing))
        for url in [os.environ['SUPABASE_URL'], *os.environ['ALLOWED_ORIGINS'].split(',')]:
            parsed = urlsplit(url.strip())
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.query:
                raise RuntimeError('Production service URLs and CORS origins must use HTTPS')
