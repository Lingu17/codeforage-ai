"""Bounded embedding calls. Failures are never represented as vectors."""
import math
import os
import random
import threading
import time
import httpx
from google.genai import types

_rate_lock = threading.Lock()
_next_request = 0.0
_retry_lock = threading.Lock()
_retry_count = 0


class EmbeddingError(RuntimeError):
    pass


def retry_count():
    with _retry_lock:
        return _retry_count


def valid_vector(vector):
    return (isinstance(vector, (list, tuple)) and len(vector) == 768
            and all(isinstance(v, (float, int)) and math.isfinite(v) for v in vector)
            and any(abs(v) > 1e-9 for v in vector))


def _wait(seconds, cancel):
    if cancel is not None:
        if cancel.wait(seconds):
            raise EmbeddingError('Indexing cancelled')
    else:
        time.sleep(seconds)


def _rate_limit(cancel):
    global _next_request
    interval = 60 / int(os.getenv('EMBED_REQUESTS_PER_MINUTE', '60'))
    with _rate_lock:
        now = time.monotonic()
        wait = max(0, _next_request - now)
        _next_request = max(now, _next_request) + interval
    _wait(wait, cancel)


def embed_batch(client, texts, *, query=False, cancel=None):
    global _retry_count
    if not texts:
        return []
    model = os.getenv('EMBED_MODEL', 'gemini-embedding-2')
    version2 = 'gemini-embedding-2' in model
    contents = [types.Content(parts=[types.Part.from_text(text=(
        f'task: code retrieval | query: {text}' if query else f'title: none | text: {text}'
    ))]) for text in texts] if version2 else texts
    config = types.EmbedContentConfig(output_dimensionality=768,
        **({} if version2 else {'task_type': 'RETRIEVAL_QUERY' if query else 'RETRIEVAL_DOCUMENT'}))
    attempts = int(os.getenv('EMBED_MAX_RETRIES', '3'))
    for attempt in range(attempts + 1):
        if cancel is not None and cancel.is_set():
            raise EmbeddingError('Indexing cancelled')
        _rate_limit(cancel)
        try:
            response = client.models.embed_content(model=model, contents=contents, config=config)
            vectors = [list(item.values or []) for item in response.embeddings or []]
            if len(vectors) != len(texts) or not all(valid_vector(v) for v in vectors):
                raise EmbeddingError('Invalid embedding response')
            return vectors
        except Exception as exc:
            code = getattr(exc, 'code', None) or getattr(exc, 'status_code', None)
            retryable = isinstance(exc, (httpx.TimeoutException, httpx.TransportError)) or code in (408, 429, 500, 502, 503, 504)
            if not retryable or attempt == attempts:
                raise EmbeddingError('Embedding provider failed') from exc
            with _retry_lock:
                _retry_count += 1
            _wait(min(2 ** attempt + random.SystemRandom().random(), 15), cancel)
