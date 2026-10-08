"""Bound payloads and public submissions; attach a correlation ID."""
import time
import threading
import uuid
import logging
from collections import deque
from starlette.responses import JSONResponse

log = logging.getLogger('codeforge.requests')
_contacts = {}
_lock = threading.Lock()


class RequestGuard:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        request_id = uuid.uuid4().hex
        scope.setdefault('state', {})['request_id'] = request_id
        headers = dict(scope['headers'])
        limit = 256_000
        try:
            length = int(headers.get(b'content-length', b'0'))
        except ValueError:
            return await JSONResponse({'detail': 'Invalid content length'}, 400)(scope, receive, send)
        if length < 0 or length > limit:
            return await JSONResponse({'detail': 'Request payload too large'}, 413)(scope, receive, send)
        if scope['path'] == '/api/contact' and scope['method'] == 'POST':
            # Use the direct peer. Forwarded headers are untrusted unless the
            # deployment explicitly configures a trusted proxy at the ASGI layer.
            peer = (scope.get('client') or ('unknown',))[0]
            now = time.monotonic()
            with _lock:
                for key in list(_contacts):
                    if not _contacts[key] or now - _contacts[key][-1] > 3600:
                        del _contacts[key]
                events = _contacts.setdefault(peer, deque())
                while events and now - events[0] > 3600:
                    events.popleft()
                if len(events) >= 5 or len(_contacts) > 10000:
                    return await JSONResponse({'detail': 'Too many submissions. Try again later.'}, 429)(scope, receive, send)
                events.append(now)
        # Buffer only bounded request bodies, so chunked requests cannot bypass
        # the size check. After replay, keep receive available for SSE disconnects.
        events, size = [], 0
        while True:
            event = await receive()
            events.append(event)
            size += len(event.get('body', b''))
            if size > limit:
                return await JSONResponse({'detail': 'Request payload too large'}, 413)(scope, receive, send)
            if event['type'] != 'http.request' or not event.get('more_body'):
                break
        async def replay():
            return events.pop(0) if events else await receive()
        async def tagged_send(event):
            if event['type'] == 'http.response.start':
                event.setdefault('headers', []).append((b'x-request-id', request_id.encode()))
                log.info('request_id=%s method=%s status=%s', request_id, scope['method'], event['status'])
            await send(event)
        await self.app(scope, replay, tagged_send)
