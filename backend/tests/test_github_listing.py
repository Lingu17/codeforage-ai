from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import BackgroundTasks, HTTPException
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client():
    main.app.dependency_overrides[main.get_authenticated_user_id] = lambda: 'owner'
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.get_authenticated_user_id, None)


def test_listing_paginates_without_following_untrusted_urls(client):
    responses = [httpx.Response(200, json=[{'id': i} for i in range(100)]),
                 httpx.Response(200, json=[{'id': 100}])]
    upstream = AsyncMock(side_effect=responses)
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github', headers={'X-GitHub-Token': 'provider-placeholder'})
    assert response.status_code == 200
    assert len(response.json()) == 101
    assert [call.kwargs['params']['page'] for call in upstream.call_args_list] == [1, 2]


@pytest.mark.parametrize('status,headers,expected', [
    (401, {}, 401), (403, {}, 403), (404, {}, 404), (422, {}, 422),
    (403, {'x-ratelimit-remaining': '0', 'retry-after': '60'}, 429),
    (429, {'retry-after': '60'}, 429), (500, {}, 502),
])
def test_listing_errors_are_sanitized(client, status, headers, expected):
    upstream = AsyncMock(return_value=httpx.Response(status, headers=headers, json={'message': 'private upstream details'}))
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github', headers={'X-GitHub-Token': 'provider-placeholder'})
    assert response.status_code == expected
    assert 'private upstream details' not in response.text
    if expected == 429:
        assert response.headers['retry-after'] == '60'
    assert upstream.call_count == 1


def test_public_listing_without_provider_token(client):
    upstream = AsyncMock(return_value=httpx.Response(200, json=[{'id': 1, 'private': False}]))
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github?username=owner')
    assert response.status_code == 200
    assert upstream.call_args.args[0] == 'https://api.github.com/users/owner/repos'
    assert 'Authorization' not in upstream.call_args.kwargs['headers']


def test_missing_identity_requires_reconnection(client):
    response = client.get('/api/repos/github')
    assert response.status_code == 400
    assert 'GitHub' in response.json()['detail']


def test_rate_limit_retry_header_is_visible_to_browser(client):
    upstream = AsyncMock(return_value=httpx.Response(403, headers={'x-ratelimit-remaining': '0'}, json={'message': 'rate limit exceeded'}))
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github?username=owner', headers={'Origin': 'http://localhost:3000'})
    assert response.status_code == 429
    assert response.headers['access-control-expose-headers'] == 'Retry-After'


def test_listing_network_failure_is_sanitized(client):
    upstream = AsyncMock(side_effect=httpx.ConnectError('sensitive connection details'))
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github?username=owner')
    assert response.status_code == 502
    assert 'sensitive' not in response.text


def test_secondary_rate_limit_does_not_return_partial_listing(client):
    upstream = AsyncMock(side_effect=[httpx.Response(200, json=[{'id': i} for i in range(100)]),
                                     httpx.Response(403, json={'message': 'secondary rate limit exceeded'})])
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github?username=owner')
    assert response.status_code == 429
    assert 'detail' in response.json()
    assert upstream.call_count == 2


def test_malformed_upstream_list_is_not_success(client):
    upstream = AsyncMock(return_value=httpx.Response(200, json={'message': 'unexpected private detail'}))
    with patch('main.httpx.AsyncClient.get', upstream):
        response = client.get('/api/repos/github?username=owner')
    assert response.status_code == 502
    assert 'private detail' not in response.text


@pytest.mark.parametrize('private', [False, True])
def test_analysis_public_access_is_independent_of_cached_credential(private):
    req = main.AnalyzeRepoRequest(github_id=1, name='repo', full_name='owner/repo',
                                 owner_username='owner', repo_url='https://github.com/owner/repo')
    identity = {'id': 1, 'full_name': 'owner/repo', 'private': private, 'default_branch': 'main'}
    responses = ([httpx.Response(404)] if private else []) + [httpx.Response(200, json=identity)]
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
    db.table.return_value.insert.return_value.execute.return_value.data = [{'id': 'created'}]
    tasks = BackgroundTasks()
    with patch('main.httpx.Client.get', side_effect=responses) as upstream, patch('main.get_supabase_client', return_value=db):
        result = main.analyze_repository(req, tasks, user_id='owner', token='session-placeholder', x_github_token='provider-placeholder')
    assert result['status'] == 'queued'
    assert 'Authorization' not in upstream.call_args_list[0].kwargs['headers']
    assert len(upstream.call_args_list) == (2 if private else 1)
    assert tasks.tasks[0].args[-1] == ('provider-placeholder' if private else None)
    if private:
        assert upstream.call_args_list[1].kwargs['headers']['Authorization'] == 'Bearer provider-placeholder'


def test_private_analysis_without_authorization_cannot_queue_work():
    req = main.AnalyzeRepoRequest(github_id=1, name='repo', full_name='owner/repo',
                                 owner_username='owner', repo_url='https://github.com/owner/repo')
    tasks = BackgroundTasks()
    with patch('main.httpx.Client.get', return_value=httpx.Response(404)), patch('main.get_supabase_client') as database:
        with pytest.raises(HTTPException) as error:
            main.analyze_repository(req, tasks, user_id='owner', token='session-placeholder', x_github_token=None)
    assert error.value.status_code == 404
    assert not tasks.tasks
    database.assert_not_called()


def test_revoked_private_authorization_cannot_queue_work():
    req = main.AnalyzeRepoRequest(github_id=1, name='repo', full_name='owner/repo',
                                 owner_username='owner', repo_url='https://github.com/owner/repo')
    tasks = BackgroundTasks()
    with patch('main.httpx.Client.get', side_effect=[httpx.Response(404), httpx.Response(401)]), patch('main.get_supabase_client') as database:
        with pytest.raises(HTTPException) as error:
            main.analyze_repository(req, tasks, user_id='owner', token='session-placeholder', x_github_token='revoked-placeholder')
    assert error.value.status_code == 401
    assert not tasks.tasks
    database.assert_not_called()
