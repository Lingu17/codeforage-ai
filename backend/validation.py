"""Input constraints shared by HTTP endpoints and background workers."""
import re
from urllib.parse import urlsplit


def github_repository_url(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' or parsed.netloc != 'github.com' or parsed.query
            or parsed.fragment or parsed.username or parsed.password):
        raise ValueError('Use an HTTPS github.com owner/repository URL')
    path = parsed.path.rstrip('/')
    if path.endswith('.git'):
        path = path[:-4]
    if not re.fullmatch(r'/[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]{1,100}', path):
        raise ValueError('Use an HTTPS github.com owner/repository URL')
    if path.rsplit('/', 1)[-1] in ('.', '..'):
        raise ValueError('Invalid repository name')
    return 'https://github.com' + path
