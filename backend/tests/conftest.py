import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Unit tests must not depend on local credentials or load real provider keys.
# The client constructors can use placeholders; network operations are mocked.
os.environ.update({
    'APP_ENV': 'test',
    'SUPABASE_URL': 'https://unit-test.supabase.co',
    'SUPABASE_ANON_KEY': 'placeholder-only',
    'GEMINI_API_KEY': 'placeholder-only',
    'GROQ_API_KEY': 'placeholder-only',
})
