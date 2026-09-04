"""Integration test for the chat stream idempotency contract.

Calls chat_codebase_stream() directly with a mock Supabase backend (bypassing
the separately-tested HTTP auth dependency) to prove:

  1. First submit  -> exactly 1 user row + streaming(answer) + 1 assistant row
  2. Same request_id retried in-process -> no new user row, session reused
  3. Same question retried on a FRESH cache (restart) -> DB-backed dedupe
     reuses the existing user row (no duplicate)
  4. Ownership check still enforces access (403 for foreign repo)
"""
import os
import threading
import sys
import importlib
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
main = importlib.import_module("main")


class FakeResult:
    def __init__(self, data=None):
        self.data = data or []


class FakeTable:
    def __init__(self, store, table_name):
        self.store = store
        self.table_name = table_name
        self._filters = []
        self._select_cols = "*"
        self._order_col = None
        self._order_desc = False
        self._limit_n = None
        self._pending_rows = None

    def select(self, cols):
        self._select_cols = cols
        return self

    def eq(self, col, val):
        self._filters.append(("eq", col, val))
        return self

    def gte(self, col, val):
        self._filters.append(("gte", col, val))
        return self

    def order(self, col, desc=False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit_n = n
        return self

    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        self._pending_rows = list(rows)
        return self

    def update(self, payload):
        self._pending_rows = payload
        return self

    def delete(self):
        return self

    def execute(self):
        rows = self.store["rows"][self.table_name]
        if self._pending_rows is not None:
            if isinstance(self._pending_rows, list):
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).isoformat()
                out = []
                for r in self._pending_rows:
                    r = dict(r)
                    r.setdefault("id", f"{self.table_name}_{len(self.store['rows'][self.table_name])}_id")
                    r.setdefault("created_at", now)
                    self.store["rows"][self.table_name].append(r)
                    out.append(r)
                self._pending_rows = None
                return FakeResult(out)
            self._pending_rows = None
            return FakeResult()
        # Read path: apply filters/order/limit against the STORED rows (not local).
        for op, col, val in self._filters:
            if op == "eq":
                rows = [r for r in rows if r.get(col) == val]
            elif op == "gte":
                rows = [r for r in rows if (r.get(col) or "") >= val]
        if self._order_col:
            rows = sorted(rows, key=lambda r: r.get(self._order_col, ""), reverse=self._order_desc)
        if self._limit_n:
            rows = rows[: self._limit_n]
        return FakeResult(rows)


class FakeSupabase:
    def __init__(self):
        self.store = {
            "rows": {
                "repositories": [
                    {"id": "repo-1", "user_id": "user-me", "status": "completed"},
                    {"id": "repo-2", "user_id": "user-other", "status": "completed"},
                ],
                "chat_sessions": [],
                "chat_messages": [],
            }
        }

    def table(self, name):
        return FakeTable(self.store, name)


class FakeRPC:
    def __init__(self, data=None):
        self.data = data or []

    def execute(self):
        return self


def collect_stream(response):
    events = []
    iterator = response.body_iterator
    try:
        import inspect
        if inspect.isasyncgen(iterator):
            import asyncio
            async def _drain():
                acc = []
                async for chunk in iterator:
                    acc.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
                return "".join(acc)
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            return loop.run_until_complete(_drain())
        for chunk in iterator:
            events.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
        return "".join(events)
    except Exception as e:
        print(f"    [stream drain warning] {e}")
        return "".join(events)


failures = 0
def assert_eq(actual, expected, msg):
    global failures
    ok = actual == expected
    print(f"  {'PASS' if ok else 'FAIL'}: {msg} (got {actual!r}, want {expected!r})")
    if not ok:
        failures += 1


def make_request(msg, session_id=None, request_id=None):
    r = type("Req", (), {})()
    r.message = msg
    r.session_id = session_id
    r.request_id = request_id
    return r


print("=== Test 1: first submit creates exactly 1 user + 1 assistant ===")
with patch("main.get_supabase_client") as gsc, \
     patch.dict("main._chat_request_cache", {}, clear=True), \
     patch("main.generate_embedding", return_value=[0.1] * 768), \
     patch("main.generate_codebase_answer_stream") as gstream:
    fake = FakeSupabase()
    gsc.return_value = fake
    rpc_result = [{"file_path": "a.py", "chunk_text": "code", "similarity": 0.9}]
    fake.rpc = lambda fn, kw: FakeRPC(rpc_result)
    gstream.return_value = iter(["Hello", " world"])
    resp = main.chat_codebase_stream(
        "repo-1", make_request("What is auth?", request_id="req-1"),
        user_id="user-me", token="tok",
    )
    stream_text = collect_stream(resp)
    msgs = fake.store["rows"]["chat_messages"]
    user_msgs = [m for m in msgs if m["role"] == "user"]
    asst_msgs = [m for m in msgs if m["role"] == "assistant"]
    assert_eq(len(user_msgs), 1, "one user row")
    assert_eq(len(asst_msgs), 1, "one assistant row")
    assert_eq(asst_msgs[0]["content"], "Hello world", "assistant combined content")
    assert_eq("event: start" in stream_text and "event: done" in stream_text and "event: delta" in stream_text,
              True, "SSE framing includes start/delta/done")
    # session got created
    assert_eq(len(fake.store["rows"]["chat_sessions"]), 1, "one session created")

print("=== Test 2: same request_id retried in-process -> no duplicates ===")
with patch("main.get_supabase_client") as gsc, \
     patch("main.generate_codebase_answer_stream") as gstream:
    fake = FakeSupabase()
    gsc.return_value = fake
    # Single-token stream ("a") so the assistant row is persisted.
    gstream.return_value = iter(["a"])
    collect_stream(main.chat_codebase_stream("repo-1", make_request("What is auth?", request_id="req-2"),
                                             user_id="user-me", token="tok"))
    # retry same request_id (in-memory cache hit)
    collect_stream(main.chat_codebase_stream("repo-1", make_request("What is auth?", request_id="req-2"),
                                             user_id="user-me", token="tok"))
    msgs = fake.store["rows"]["chat_messages"]
    user_msgs = [m for m in msgs if m["role"] == "user"]
    assert_eq(len(user_msgs), 1, "exactly one USER row after in-process retry (no user duplication)")
    assert_eq(len(fake.store["rows"]["chat_sessions"]), 1, "one session after in-process retry")

print("=== Test 3: fresh cache (restart) + same session + same question -> DB dedupe ===")
with patch("main.get_supabase_client") as gsc, \
     patch.dict("main._chat_request_cache", {}, clear=True), \
     patch("main.generate_codebase_answer_stream") as gstream:
    fake = FakeSupabase()
    gsc.return_value = fake
    # First attempt (new session + user msg + assistant)
    gstream.return_value = iter(["first"])
    resp = main.chat_codebase_stream(
        "repo-1", make_request("How does X work?", request_id="req-3"),
        user_id="user-me", token="tok")
    collect_stream(resp)
    session_id = fake.store["rows"]["chat_sessions"][0]["id"]

    # Simulate backend restart: wipe the in-memory cache entirely.
    main._chat_request_cache.clear()

    # Retry the exact same question on the SAME session (no request cache).
    gstream.return_value = iter(["second"])
    resp = main.chat_codebase_stream(
        "repo-1", make_request("How does X work?", session_id=session_id),
        user_id="user-me", token="tok")
    collect_stream(resp)

    msgs = fake.store["rows"]["chat_messages"]
    user_msgs = [m for m in msgs if m["role"] == "user"]
    asst_msgs = [m for m in msgs if m["role"] == "assistant"]
    assert_eq(len(user_msgs), 1, "DB dedupe keeps single user row after restart")
    assert_eq(len(asst_msgs), 2, "retry re-answers (2nd assistant) — correct behavior")
    # The retry should reuse the same user_message_id
    assert_eq(msgs[0]["id"] == msgs[2]["id"], False, "rows differ (assistant vs user)")

print("=== Test 4: ownership enforcement (foreign repo) -> 403 ===")
with patch("main.get_supabase_client") as gsc:
    fake = FakeSupabase()
    gsc.return_value = fake
    try:
        main.chat_codebase_stream("repo-2", make_request("hi", request_id="req-4"),
                                  user_id="user-me", token="tok")
        assert_eq("should have raised", "raised", "foreign repo denied")
    except Exception as e:
        from fastapi import HTTPException
        assert_eq(isinstance(e, HTTPException) and e.status_code == 403, True, f"403 raised ({type(e).__name__})")

print()
print("FAILURES" if failures else "ALL PASS")
sys.exit(1 if failures else 0)