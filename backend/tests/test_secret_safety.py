import base64
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

import pytest

import config
import database


def role_key(role):
    payload = base64.urlsafe_b64encode(json.dumps({'role': role}).encode()).decode().rstrip('=')
    return 'header.' + payload + '.signature'


@pytest.mark.parametrize('key', ['sb_secret_' + 'x' * 32, role_key('service_role')])
def test_public_client_refuses_privileged_keys(key, monkeypatch):
    monkeypatch.setenv('SUPABASE_ANON_KEY', key)
    with pytest.raises(RuntimeError) as error:
        config.validate_config()
    assert key not in str(error.value)
    with patch.object(database, 'SUPABASE_KEY', key), patch('database.create_client') as create:
        with pytest.raises(RuntimeError):
            database.get_supabase_client()
    create.assert_not_called()


@pytest.mark.parametrize('key', ['sb_publishable_' + 'x' * 32, role_key('anon')])
def test_public_key_allowed_but_not_for_privileged_contact_client(key, monkeypatch):
    config.validate_public_supabase_key(key)
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', key)
    with patch('database.create_client') as create, pytest.raises(RuntimeError):
        database.get_contact_client()
    create.assert_not_called()


def test_absent_contact_secret_fails_without_network(monkeypatch):
    monkeypatch.delenv('SUPABASE_SERVICE_ROLE_KEY', raising=False)
    with patch('database.create_client') as create, pytest.raises(RuntimeError, match='not configured'):
        database.get_contact_client()
    create.assert_not_called()


@pytest.mark.parametrize('key', ['sb_secret_' + 'x' * 32, role_key('service_role')])
def test_contact_client_supports_replacement_and_legacy_types(key, monkeypatch):
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', key)
    with patch('database.create_client') as create:
        database.get_contact_client()
    assert create.call_args.args == (database.SUPABASE_URL, key)
    options = create.call_args.kwargs['options']
    assert not options.auto_refresh_token and not options.persist_session

def test_modern_secret_scanner_never_returns_value():
    path = Path(__file__).resolve().parents[2] / 'tools/check_release.py'
    spec = importlib.util.spec_from_file_location('release_guard_secret_test', path)
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)
    key = 'sb_secret_' + 'x' * 32
    findings = guard.inspect_content('example.py', key)
    assert findings == [{'file': 'example.py', 'kind': 'Supabase secret key'}]
    assert key not in str(findings)
