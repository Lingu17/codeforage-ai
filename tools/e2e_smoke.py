"""Small staging API smoke. No credentials are printed or persisted.

Default: authenticated read-only reports. --chat explicitly writes staging chats.
Needs CODEFORGE_SMOKE_URL, CODEFORGE_SMOKE_TOKEN, CODEFORGE_SMOKE_REPO_ID.
Never run --chat against production without authorization.
"""
import argparse
import os
import uuid
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--chat', action='store_true', help='Write three test chats to the selected staging repository')
    args = parser.parse_args()
    names = ('CODEFORGE_SMOKE_URL','CODEFORGE_SMOKE_TOKEN','CODEFORGE_SMOKE_REPO_ID')
    if any(not os.getenv(name) for name in names):
        print('NOT VERIFIED — missing staging smoke configuration: ' + ', '.join(names))
        return 2
    url, token, repo = (os.environ[name] for name in names)
    uuid.UUID(repo)
    with httpx.Client(base_url=url, headers={'Authorization': 'Bearer '+token}, timeout=120) as client:
        for path in ['/health','/ready',*[f'/api/repos/{repo}/{endpoint}' for endpoint in ('status','summary','architecture','security','debt')]]:
            result = client.get(path)
            if result.status_code != 200:
                print(f'FAIL — endpoint {path}: HTTP {result.status_code}')
                return 1
        if args.chat:
            for question in ('What does authentication do?','What database tables are used?','Where is GitHub cloning implemented?'):
                result = client.post(f'/api/repos/{repo}/chat', json={'message': question})
                if result.status_code != 200:
                    print('FAIL — chat HTTP',result.status_code)
                    return 1
                data = result.json()
                citations = data.get('citations') or []
                if not data.get('content') or not citations:
                    print('FAIL — nonempty answer and real citations are required')
                    return 1
                for citation in citations:
                    path = citation.rsplit(':',1)[0] if ':' in citation else citation
                    source = client.get(f'/api/repos/{repo}/source',params={'file_path':path})
                    if source.status_code != 200:
                        print('FAIL — source provenance unavailable')
                        return 1
    print('PASS — authenticated API reports' + (' and three cited chats' if args.chat else '; chat/import/OAuth were not exercised'))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        print('FAIL — smoke error type:',type(exc).__name__)
        raise SystemExit(1) from None
