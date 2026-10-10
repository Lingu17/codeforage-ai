import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

import main
import scanner
import embedding
from validation import github_repository_url
from quality import security_report, health_report
from rag import retrieve_context


def test_startup_health_docs_and_readiness():
    with patch('main.get_supabase_client', side_effect=RuntimeError('private details')):
        with TestClient(main.app) as client:
            for path in ['/health', '/api/health', '/docs', '/openapi.json']:
                assert client.get(path).status_code == 200
            assert client.get('/ready').status_code == 503
            assert 'private details' not in client.get('/ready').text


@pytest.mark.parametrize('path', ['/api/repos', '/api/repos/github', '/api/repos/00000000-0000-0000-0000-000000000001/summary'])
def test_unauthenticated_denied(path):
    assert TestClient(main.app).get(path).status_code == 401


@pytest.mark.parametrize('url', ['http://github.com/a/b', 'https://github.com.evil/a/b',
    'https://github.com@evil/a/b', 'https://github.com/a/../b', 'file:///a/b',
    'https://localhost/a/b', 'https://github.com/a/b?token=secret', 'https://github.com/a/b/tree/main'])
def test_clone_ssrf_and_path_rejected(url):
    with pytest.raises(ValueError):
        github_repository_url(url)


def test_valid_repository_url():
    assert github_repository_url('https://github.com/team/project.git') == 'https://github.com/team/project'


@pytest.mark.parametrize('function', [main.get_scan_status, main.get_repo_summary,
    main.get_repo_architecture, main.get_repo_security, main.get_repo_debt, main.get_chat_sessions])
def test_cross_user_read_denied(function):
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    with patch('main.get_supabase_client', return_value=db):
        with pytest.raises(HTTPException) as exc:
            function('foreign-repo', user_id='user-a', token='token-a')
    assert exc.value.status_code == 404
    db.table.return_value.select.return_value.eq.return_value.eq.assert_called_with('user_id', 'user-a')


def test_cross_user_delete_keeps_404():
    db = MagicMock()
    db.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    with patch('main.get_supabase_client', return_value=db), pytest.raises(HTTPException) as exc:
        main.delete_repository('foreign-repo', user_id='user-a', token='token-a')
    assert exc.value.status_code == 404


def test_provider_error_not_leaked():
    with patch('main.get_supabase_client', side_effect=RuntimeError('password=secret /private/path')):
        with pytest.raises(HTTPException) as exc:
            main.get_scanned_repositories(user_id='u', token='t')
    assert 'secret' not in exc.value.detail


def test_production_missing_config(monkeypatch):
    import config
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    with pytest.raises(RuntimeError, match='Missing production configuration'):
        config.validate_config()


def test_chunk_line_metadata_and_invalid_overlap():
    text = 'line one\nline two\nline three\n'
    records = list(scanner.chunk_records(text, 12, 2))
    for record in records:
        index = record['chunk_index'] * 10
        assert record['line_start'] == text[:index].count('\n') + 1
    with pytest.raises(ValueError):
        scanner.generate_chunks(text, 10, 10)


def test_failed_embedding_never_zero_vector():
    provider = MagicMock()
    provider.models.embed_content.side_effect = ValueError('permanent failure')
    with patch('embedding._rate_limit'), pytest.raises(embedding.EmbeddingError):
        embedding.embed_batch(provider, ['code'])
    assert provider.models.embed_content.call_count == 1


def test_embedding_batch_and_retry(monkeypatch):
    provider = MagicMock()
    provider.models.embed_content.side_effect = [httpx.ReadTimeout('timeout'),
        SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1]*768), SimpleNamespace(values=[0.2]*768)])]
    monkeypatch.setenv('EMBED_MODEL', 'gemini-embedding-2')
    with patch('embedding._rate_limit'), patch('embedding._wait'):
        result = embedding.embed_batch(provider, ['one', 'two'])
    assert len(result) == 2
    assert provider.models.embed_content.call_count == 2
    contents = provider.models.embed_content.call_args.kwargs['contents']
    assert len(contents) == 2 and contents[0].parts[0].text.startswith('title: none')


def test_embedding_query_task(monkeypatch):
    provider = MagicMock()
    provider.models.embed_content.return_value = SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1]*768)])
    monkeypatch.setenv('EMBED_MODEL', 'gemini-embedding-2')
    with patch('embedding._rate_limit'):
        embedding.embed_batch(provider, ['question'], query=True)
    assert provider.models.embed_content.call_args.kwargs['contents'][0].parts[0].text.startswith('task: code retrieval')


def test_embedding_worker_propagates_auth():
    db = MagicMock()
    f = {'file_path': 'a.py', 'language': 'python', 'code_content': 'print(1)'}
    with patch('scanner.get_supabase_client', return_value=db) as client, patch('scanner.embed_chunks_batch', return_value=[[0.1]*768]):
        stats = scanner._embed_one('repo', f, 'file', 'token-a')
    client.assert_called_once_with('token-a')
    assert stats == {'expected': 1, 'indexed': 1, 'failed': 0}
    assert db.table.return_value.insert.call_args.args[0][0]['line_start'] == 1


def test_embedding_partial_stage_and_futures():
    runner = scanner.ScanRunner(MagicMock(), 'scan', 'auth')
    files = [{'file_path': 'a.py', 'language': 'python', 'size': 1, 'code_content': 'x'}]
    with patch('scanner._embed_one', return_value={'expected': 1, 'indexed': 0, 'failed': 1}):
        scanner.run_embed_stage(runner, 'auth', 'repo', {'a.py': 'file'}, files)
    assert runner.stages['embed']['status'] == 'failed'
    assert runner.stages['embed']['chunks_failed'] == 1


def test_failed_stage_cannot_report_complete():
    stages = {key: {'status': 'completed'} for key in scanner.STAGE_ORDER}
    stages['embed'] = {'status': 'failed'}
    assert scanner.compute_aggregate(stages)[0] == 'partial'
    stages['clone'] = {'status': 'failed'}
    assert scanner.compute_aggregate(stages)[0] == 'failed'


def test_file_discovery_skips_generated_paths(tmp_path):
    (tmp_path / 'node_modules').mkdir()
    (tmp_path / 'node_modules/a.py').write_text('secret')
    (tmp_path / 'src').mkdir()
    (tmp_path / 'src/building.py').write_text('print(1)')
    assert [f['file_path'] for f in scanner.collect_files(str(tmp_path))] == ['src/building.py']


def test_security_redacts_and_grounds_lines():
    f = {'file_path': 'a.py', 'language': 'python', 'code_content': 'token="ghp_' + 'a'*36 + '"\neval(data)'}
    report = security_report([f])
    assert len(report['vulnerabilities']) == 2
    assert report['vulnerabilities'][0]['line'] == 1
    assert report['vulnerabilities'][0]['evidence'] == '[REDACTED]'
    assert 'ghp_' not in json.dumps(report)
    assert security_report([{'file_path': 'b.py', 'language': 'python', 'code_content': 'import os'}])['vulnerabilities'] == []


def test_health_does_not_invent_coverage_or_performance():
    f = {'file_path': 'a.py', 'language': 'python', 'code_content': 'print(1)', 'imports': [], 'functions': [], 'classes': []}
    report = health_report([f], {'cycles': []})['health']
    assert report['testing_score'] is None and report['performance_score'] is None
    assert report['breakdown']['status'] == 'partial'
    assert health_report([], {'cycles': []})['health']['overall_score'] is None


def test_import_graph_dotted_resolution_and_cycles():
    files = [{'file_path': 'pkg/a.py', 'language': 'python', 'imports': ['pkg.b']},
             {'file_path': 'pkg/b.py', 'language': 'python', 'imports': ['pkg.a']}]
    graph = scanner.resolve_dependency_graph(files)
    assert len(graph['edges']) == 2 and graph['cycles']
    assert all(e['data']['circular'] for e in graph['edges'])


def test_retrieval_limits_context_and_real_citations():
    db = MagicMock()
    chunk = {'id': 'chunk', 'file_path': 'a.py', 'line_start': 10, 'line_end': 20, 'chunk_text': 'x'*30000}
    db.rpc.return_value.execute.return_value.data = [chunk]
    context, citations, sources = retrieve_context(db, 'repo-a', 'q', [0.1]*768)
    assert len(context) < 19000
    assert citations == ['a.py:10–10']
    assert sources[0]['chunk_id'] == 'chunk'
    assert all(c.args[1]['repo_id'] == 'repo-a' for c in db.rpc.call_args_list)


def test_contact_and_diff_limits():
    with pytest.raises(ValidationError):
        main.ContactRequest(name='a', email='bad', subject='s', message='m')
    with pytest.raises(ValidationError):
        main.PRReviewRequest(diff_content='x'*100001, repository_id='00000000-0000-0000-0000-000000000001')
    assert TestClient(main.app).post('/api/contact', content='x'*256001).status_code == 413


def test_pr_review_rejects_invented_locations_and_categories():
    from pr_review import validate_review
    diff = "+++ b/a.py\n@@ -1,1 +1,2 @@\n context\n+added\n"
    review = {'summary': 'Change', 'risk_level': 'Low', 'recommendations': [
        {'file': 'a.py', 'line': 2, 'type': 'BUG', 'description': 'Review this added line'}]}
    assert validate_review(review, diff) == review
    review['recommendations'][0]['line'] = 1
    with pytest.raises(ValueError):
        validate_review(review, diff)
    review['recommendations'][0]['line'] = 2
    review['recommendations'][0]['type'] = 'invented'
    with pytest.raises(ValueError):
        validate_review(review, diff)


def test_provider_output_tokens_are_bounded():
    from ai_groq import _build_payload
    assert _build_payload([])['max_tokens'] == 4096
    assert _build_payload([], max_tokens=100000)['max_tokens'] == 8192


def test_supabase_sync_options_match_installed_sdk():
    from database import get_supabase_client
    from supabase.lib.client_options import SyncClientOptions
    with patch('database.create_client') as create:
        get_supabase_client('access-token')
    options = create.call_args.kwargs['options']
    assert isinstance(options, SyncClientOptions)
    assert options.storage is not None
    assert not options.persist_session and not options.auto_refresh_token


def test_readiness_detects_missing_migrations():
    from schema_check import verify_schema
    db = MagicMock()
    db.table.return_value.select.return_value.limit.return_value.execute.side_effect = RuntimeError('private details')
    failures = verify_schema(db)
    assert failures and 'private details' not in str(failures)
    with patch('main.get_supabase_client',return_value=db):
        response = TestClient(main.app).get('/ready')
        assert response.status_code == 503
        assert 'migrations' in response.json()['detail']


def test_stale_scan_recovery_preserves_coverage_and_finished_stages():
    from scan_recovery import recover_stale_scan
    from datetime import datetime,timezone
    db=MagicMock()
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data=[{'id':'job'}]
    job={'id':'job','status':'embedding','heartbeat_at':'2020-01-01T00:00:00Z','stages':{'clone':{'status':'completed'},'embed':{'status':'running','chunks_indexed':8,'chunks_expected':10}}}
    recovered=recover_stale_scan(db,job,now=datetime(2026,1,1,tzinfo=timezone.utc))
    assert recovered['status']=='failed'
    assert recovered['stages']['clone']['status']=='completed'
    assert recovered['stages']['embed']['status']=='failed'
    assert recovered['stages']['embed']['chunks_indexed']==8
    assert job['stages']['embed']['status']=='running'


def test_stale_snapshot_cannot_override_concurrent_heartbeat():
    from scan_recovery import recover_stale_scan
    db=MagicMock()
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data=[]
    fresh={'id':'job','status':'embedding','heartbeat_at':'2099-01-01T00:00:00Z'}
    db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data=[fresh]
    assert recover_stale_scan(db,{'id':'job','status':'embedding','heartbeat_at':'2020-01-01T00:00:00Z'})==fresh


def test_partial_ten_chunks_and_retry_reuses_eight_successes():
    chunks=[{'chunk_index':i,'chunk_text':str(i),'line_start':i+1,'line_end':i+1} for i in range(10)]
    db=MagicMock()
    cached=[{**c,'embedding_model':scanner.EMBED_MODEL} for c in chunks[:8]]
    query=db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute
    query.return_value.data=[]
    f={'file_path':'a.py','language':'python','code_content':'x'}
    with patch('scanner.chunk_records',return_value=iter(chunks)),patch('scanner.get_supabase_client',return_value=db),patch('scanner.EMBED_BATCH_SIZE',2),patch('scanner.embed_chunks_batch',side_effect=[[ [0.1]*768 ]*2 for _ in range(4)]+[RuntimeError('provider failure')]):
        first=scanner._embed_one('repo',f,'file','token')
    assert first=={'expected':10,'indexed':8,'failed':2}
    query.return_value.data=cached
    with patch('scanner.chunk_records',return_value=iter(chunks)),patch('scanner.get_supabase_client',return_value=db),patch('scanner.embed_chunks_batch',return_value=[[0.1]*768]*2) as embed:
        retry=scanner._embed_one('repo',f,'file','token')
    assert retry=={'expected':10,'indexed':10,'failed':0}
    assert embed.call_args.args[0]==['8','9']
    runner=scanner.ScanRunner(MagicMock(),'job','token')
    runner.stages['embed']['chunks_expected']=10
    with patch('scanner._embed_one',return_value=first),patch('scanner.should_embed',return_value=True):
        scanner.run_embed_stage(runner,'token','repo',{'a.py':'file'},[f])
    assert runner.stages['embed']['status']=='partial'
    assert runner.stages['embed']['coverage_percentage']==80


def test_external_graph_uses_only_observed_imports():
    files=[{'file_path':'app.py','language':'python','imports':['fastapi','local.module','.relative']},
           {'file_path':'local/module.py','language':'python','imports':[]}]
    graph=scanner.resolve_dependency_graph(files)
    external=[n for n in graph['nodes'] if n['data']['kind']=='external']
    assert [n['data']['package_name'] for n in external]==['fastapi']
    assert any(e['source']=='app.py' and e['target']=='external:python:fastapi' for e in graph['edges'])
    assert not any('PostgreSQL' in n['id'] for n in graph['nodes'])


def test_repeated_imports_do_not_duplicate_graph_edges_or_dependents():
    files = [{'file_path': 'app.py', 'language': 'python',
              'imports': ['datetime', 'datetime', 'datetime.timezone', 'local.module', 'local.module']},
             {'file_path': 'local/module.py', 'language': 'python', 'imports': []}]
    graph = scanner.resolve_dependency_graph(files)
    assert len(graph['edges']) == 3
    assert len({edge['id'] for edge in graph['edges']}) == len(graph['edges'])
    external = next(node for node in graph['nodes'] if node['data']['kind'] == 'external')
    assert external['data']['imported_by'] == ['app.py']


@pytest.mark.parametrize('code,attempts',[(401,1),(403,1),(400,1),(429,3),(500,3),(503,3)])
def test_embedding_provider_failures_have_bounded_retry(code,attempts,monkeypatch):
    class ProviderFailure(Exception): pass
    failure=ProviderFailure('sensitive provider detail');failure.code=code
    provider=MagicMock();provider.models.embed_content.side_effect=failure
    monkeypatch.setenv('EMBED_MAX_RETRIES','2')
    with patch('embedding._rate_limit'),patch('embedding._wait'),pytest.raises(embedding.EmbeddingError):
        embedding.embed_batch(provider,['code'])
    assert provider.models.embed_content.call_count==attempts


@pytest.mark.parametrize('name',['supabase_schema.sql','migration_v2.sql','migration_v3.sql','migration_v4.sql','migration_v5.sql','migration_v6.sql','migration_v7.sql','migration_v8.sql','tests/db_bootstrap.sql','tests/rls_isolation.sql','tests/schema_contract.sql'])
def test_migration_and_database_test_sql_parses(name):
    from pathlib import Path
    from pglast import parse_sql
    source=(Path(__file__).resolve().parents[1]/name).read_text(encoding='utf8')
    assert parse_sql(source)
    if name in ('migration_v7.sql', 'migration_v8.sql'):
        from pglast import parse_plpgsql
        assert parse_plpgsql(source)
    assert 'DROP COLUMN' not in source.upper()


@pytest.mark.parametrize('status,expected',[(401,401),(403,403),(404,404),(429,429),(500,502),(503,502)])
def test_github_error_classification_does_not_leak_provider_detail(status,expected):
    with pytest.raises(HTTPException) as failure:
        main.github_error(status)
    assert failure.value.status_code==expected
    assert 'token' not in failure.value.detail.lower()


def test_release_guard_rejects_keys_and_generated_artifacts():
    import importlib.util
    from pathlib import Path
    path=Path(__file__).resolve().parents[2]/'tools/check_release.py'
    spec=importlib.util.spec_from_file_location('release_guard',path)
    guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
    secret='gsk_'+'a'*40
    result=guard.inspect_content('source.py',secret)
    assert result and secret not in str(result)
    assert guard.forbidden_path('backend/.env.production')
    assert guard.forbidden_path('backend/venv/package.py')
    assert not guard.forbidden_path('backend/.env.example')


def test_worker_cannot_revive_terminal_scan():
    db=MagicMock()
    db.table.return_value.update.return_value.eq.return_value.in_.return_value.execute.return_value.data=[]
    runner=scanner.ScanRunner(db,'job','token')
    runner._persist('embedding',20)
    assert runner.cancel.is_set()
    assert db.table.return_value.update.return_value.eq.return_value.in_.call_args.args[0]=='status'


@pytest.mark.parametrize('github_token', [None, 'github-provider-token'])
def test_github_listing_never_forwards_login_token(github_token):
    from unittest.mock import AsyncMock
    main.app.dependency_overrides[main.get_authenticated_user_id] = lambda: 'user-a'
    upstream = MagicMock(status_code=200)
    upstream.json.return_value = []
    outbound = AsyncMock(return_value=upstream)
    headers = {'Authorization': 'Bearer supabase-login-token'}
    if github_token:
        headers['X-GitHub-Token'] = github_token
    try:
        with patch('main.httpx.AsyncClient.get', outbound):
            response = TestClient(main.app).get('/api/repos/github?username=fixture', headers=headers)
        assert response.status_code == 200
        sent = outbound.call_args.kwargs['headers']
        assert sent.get('Authorization') == (f'Bearer {github_token}' if github_token else None)
        assert outbound.call_args.args[0] == ('https://api.github.com/user/repos' if github_token else 'https://api.github.com/users/fixture/repos')
    finally:
        main.app.dependency_overrides.pop(main.get_authenticated_user_id, None)


@pytest.mark.parametrize('missing_column', ['question', 'session_id', 'user_message_id', None])
def test_readiness_checks_complete_chat_claim_columns(missing_column):
    from schema_check import REQUIRED_COLUMNS, verify_schema
    required = {'question', 'session_id', 'user_message_id', 'user_id', 'repository_id', 'updated_at'}
    assert required <= set(REQUIRED_COLUMNS['chat_requests'].split(','))
    db = MagicMock()
    def table(name):
        query = MagicMock()
        if name == 'chat_requests' and missing_column:
            def select(columns):
                assert missing_column in columns.split(',')
                query.limit.return_value.execute.side_effect = RuntimeError(f'missing {missing_column}')
                return query
            query.select.side_effect = select
        return query
    db.table.side_effect = table
    assert verify_schema(db) == ([{'table': 'chat_requests', 'code': 'RuntimeError'}] if missing_column else [])
    with patch('main.get_supabase_client', return_value=db):
        response = TestClient(main.app).get('/ready')
    assert response.status_code == (503 if missing_column else 200)
    if missing_column:
        assert 'migrations' in response.json()['detail']
        assert f'missing {missing_column}' not in response.text
    else:
        assert response.json() == {'status': 'ready'}
