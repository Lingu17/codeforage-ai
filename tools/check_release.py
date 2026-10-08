"""Scan candidate/staged Git files without printing credential values.

This signature scan is a release guard, not a guarantee of secret absence.
Local ignored environment files are never read. Deleted artifacts are ignored.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

PATTERNS = {
    'GitHub token': r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'Google API key': r'AIza[0-9A-Za-z_-]{30,}',
    'Groq API key': r'gsk_[A-Za-z0-9]{30,}',
    'OpenAI API key': r'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}',
    'Private key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'AWS access key': r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'Database credential URL': r'postgres(?:ql)?://[^\s/:]+:[^\s@]+@',
}


def inspect_content(path, content):
    findings = []
    for label, pattern in PATTERNS.items():
        if re.search(pattern, content):
            findings.append({'file': path, 'kind': label})
    # Server-role JWTs must never be versioned, even under misleading names.
    import base64
    for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', content):
        try:
            payload = token.split('.')[1]
            claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
            if claims.get('role') == 'service_role':
                findings.append({'file': path, 'kind': 'Supabase service-role JWT'})
        except (ValueError, UnicodeError):
            continue
    return findings


def forbidden_path(path):
    p = Path(path)
    return (any(part in {'node_modules','venv','.venv','__pycache__','.next'} for part in p.parts)
            or (p.name.startswith('.env') and p.name != '.env.example')
            or p.suffix in {'.pyc','.log','.pid','.sqlite','.sqlite3','.db','.tmp'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--staged', action='store_true')
    args = parser.parse_args()
    command = ['git','diff','--cached','--name-only','--diff-filter=ACMR','-z'] if args.staged else ['git','ls-files','--cached','--others','--exclude-standard','-z']
    paths = set(subprocess.check_output(command).decode('utf8').split('\0')) - {''}
    findings = []
    scanned = 0
    for path in sorted(paths):
        if not args.staged and not Path(path).is_file():
            continue
        if forbidden_path(path):
            findings.append({'file': path, 'kind': 'Forbidden release artifact'})
            continue
        raw = subprocess.check_output(['git','show',f':{path}']) if args.staged else Path(path).read_bytes()
        if b'\0' in raw:
            continue
        scanned += 1
        findings.extend(inspect_content(path, raw.decode('utf8', errors='replace')))
    print(json.dumps({'status': 'FAIL' if findings else 'PASS', 'files_scanned': scanned, 'findings': findings}))
    return 1 if findings else 0


if __name__ == '__main__':
    raise SystemExit(main())
