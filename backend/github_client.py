"""GitHub failures are classified locally; upstream bodies never reach clients."""
import time

from fastapi import HTTPException


def github_error(status, headers=None, message=''):
    headers = headers or {}
    rate_limited = status == 429 or (status == 403 and (
        headers.get('x-ratelimit-remaining') == '0' or headers.get('retry-after')
        or 'rate limit' in message.lower()))
    if rate_limited:
        wait = headers.get('retry-after', '')
        if not isinstance(wait, str) or not wait.isdigit():
            reset = headers.get('x-ratelimit-reset', '')
            wait = str(max(1, int(reset) - int(time.time()))) if isinstance(reset, str) and reset.isdigit() else '60'
        raise HTTPException(429, 'GitHub rate limit reached. Wait before retrying.',
                            headers={'Retry-After': str(min(max(int(wait), 1), 86400))})
    messages = {
        401: 'GitHub authorization expired or was revoked. Reconnect GitHub.',
        403: 'GitHub access denied. Check OAuth repo permission and organization SSO approval.',
        404: 'GitHub repository or account unavailable. Check the URL or username; private repositories require GitHub authorization.',
        422: 'GitHub rejected the repository request. Check the repository or account details.',
    }
    raise HTTPException(status if status in messages else 502,
                        messages.get(status, 'GitHub is temporarily unavailable. Try again later.'))


def check_github_response(response):
    if response.status_code == 200:
        return
    try:
        body = response.json()
        message = body.get('message', '') if isinstance(body, dict) else ''
    except ValueError:
        message = ''
    github_error(response.status_code, response.headers, message if isinstance(message, str) else '')
