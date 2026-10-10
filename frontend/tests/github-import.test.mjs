import test from 'node:test';
import assert from 'node:assert/strict';
import { githubUsername, githubOAuthScopes, shouldReconnectGitHub, loadGithubRepositories, publicOrAuthorizedRepository, githubResponseError } from '../src/utils/githubImport.ts';

test('public sign-in requests no private scope; explicit private reconnect requests repo', () => {
  assert.equal(githubOAuthScopes(null), undefined);
  assert.equal(githubOAuthScopes('0'), undefined);
  assert.equal(githubOAuthScopes('1'), 'repo');
});

test('malformed successful listing reports a sanitized error instead of crashing rendering', async () => {
  const session = {access_token: 'session', provider_token: 'provider'};
  for (const body of [[null], [{id: 1}], [{id: 1, name: 123, full_name: 'owner/repo'}]]) {
    await assert.rejects(loadGithubRepositories('https://backend/repos', session, async () => Response.json(body)), /invalid repository list/);
  }
  await assert.rejects(loadGithubRepositories('https://backend/repos', session, async () => new Response('private invalid text')), /invalid repository list/);
});

test('resolve only GitHub identity metadata, never a generic display name', () => {
  assert.equal(githubUsername({user_metadata: {user_name: 'Developer'}}), null);
  assert.equal(githubUsername({identities: [{provider: 'github', identity_data: {user_name: 'actual-user'}}]}), 'actual-user');
  assert.equal(githubUsername({app_metadata: {provider: 'github'}, user_metadata: {preferred_username: 'actual-user'}}), 'actual-user');
});

test('explicit reconnect starts OAuth even for a signed-in user', () => {
  assert.equal(shouldReconnectGitHub(true, null), false);
  assert.equal(shouldReconnectGitHub(true, '1'), true);
  assert.equal(shouldReconnectGitHub(false, null), true);
});

test('listing separates login and provider credentials and omits absent username', async () => {
  let called = false;
  const repos = await loadGithubRepositories('https://backend/api/repos/github', {access_token: 'session', provider_token: 'provider'}, async (url, options) => {
    called = true;
    assert.equal(url, 'https://backend/api/repos/github');
    assert.equal(options.headers.Authorization, 'Bearer session');
    assert.equal(options.headers['X-GitHub-Token'], 'provider');
    return Response.json([{id: 1, name: 'repo', full_name: 'owner/repo', private: false, archived: true}]);
  });
  assert.ok(called);
  assert.deepEqual(repos, [{id: 1, name: 'repo', full_name: 'owner/repo', private: false, archived: true}]);
});

test('missing session and missing GitHub identity do not make a misleading request', async () => {
  const request = () => assert.fail('unexpected network call');
  await assert.rejects(loadGithubRepositories('https://backend', null, request), /Sign in again/);
  await assert.rejects(loadGithubRepositories('https://backend', {access_token: 'session'}, request), /username is unavailable/);
});

test('public listing sends no provider credential', async () => {
  await loadGithubRepositories('https://backend/repos', {access_token: 'session', user: {app_metadata: {provider: 'github'}, user_metadata: {user_name: 'owner'}}}, async (url, options) => {
    assert.equal(url, 'https://backend/repos?username=owner');
    assert.equal(options.headers['X-GitHub-Token'], undefined);
    return Response.json([]);
  });
});

test('revoked OAuth and expired CodeForge sessions have different actionable errors', async () => {
  const revoked = await githubResponseError(Response.json({detail: 'GitHub authorization expired'}, {status: 401}), true);
  assert.equal(revoked.reconnect, true);
  assert.match(revoked.message, /revoked/);
  const expired = await githubResponseError(Response.json({detail: 'Invalid session token'}, {status: 401}), true);
  assert.equal(expired.reconnect, false);
  assert.match(expired.message, /CodeForge session/);
});

test('permissions, rate limits and upstream errors are sanitized', async () => {
  for (const [status, pattern] of [[403, /permission/], [429, /60 seconds/], [500, /temporarily unavailable/]]) {
    const result = await githubResponseError(Response.json({detail: 'secret upstream text'}, {status, headers: {'Retry-After': status === 429 ? '60' : ''}}), true);
    assert.match(result.message, pattern);
    assert.ok(!result.message.includes('secret'));
  }
  const rate = await githubResponseError(Response.json({message: 'secondary rate limit'}, {status: 403}));
  assert.match(rate.message, /rate limit/);
  assert.equal(rate.reconnect, false);
  const rejected = await githubResponseError(Response.json({detail: 'private upstream text'}, {status: 422}), true);
  assert.match(rejected.message, /request was rejected/);
  assert.equal(rejected.reconnect, false);
  assert.ok(!rejected.message.includes('private upstream'));
});

test('public URL analysis ignores a revoked cached provider token', async () => {
  const repo = await publicOrAuthorizedRepository('https://github.com/owner/repo.git', 'revoked', async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/owner/repo');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({id: 1, private: false});
  });
  assert.equal(repo.private, false);
});

test('private URL uses only supplied provider authorization after anonymous 404', async () => {
  let count = 0;
  await publicOrAuthorizedRepository('https://github.com/owner/private', 'provider', async (_, options) => {
    if (++count === 1) {
      assert.equal(options.headers.Authorization, undefined);
      return new Response(null, {status: 404});
    }
    assert.equal(options.headers.Authorization, 'Bearer provider');
    return Response.json({private: true});
  });
  assert.equal(count, 2);
});

test('private URL without authorization fails; hostile URL makes no request', async () => {
  await assert.rejects(publicOrAuthorizedRepository('https://github.com/owner/private', null, async () => new Response(null, {status: 404})), /private repositories require/);
  await assert.rejects(publicOrAuthorizedRepository('https://credential@github.com/owner/repo', null, () => assert.fail('network')), /Enter a GitHub/);
});
