import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicEnvironment } from '../src/utils/publicEnvSafety.ts';

test('build rejects secret keys in public variables without showing their values', () => {
  const key = 'sb_secret_' + 'x'.repeat(32);
  assert.throws(() => validatePublicEnvironment({NEXT_PUBLIC_SUPABASE_ANON_KEY: key}), error => {
    assert.ok(!error.message.includes(key));
    return /privileged/.test(error.message);
  });
});

test('build rejects legacy service-role JWTs in any public variable', () => {
  const jwt = 'header.' + Buffer.from(JSON.stringify({role: 'service_role'})).toString('base64url') + '.signature';
  assert.throws(() => validatePublicEnvironment({NEXT_PUBLIC_OTHER: jwt}), /privileged/);
});

test('publishable, anon and backend-only variables remain allowed', () => {
  const anon = 'header.' + Buffer.from(JSON.stringify({role: 'anon'})).toString('base64url') + '.signature';
  validatePublicEnvironment({NEXT_PUBLIC_SUPABASE_ANON_KEY: anon});
  validatePublicEnvironment({NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_' + 'x'.repeat(32)});
  validatePublicEnvironment({SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_' + 'x'.repeat(32)});
});
