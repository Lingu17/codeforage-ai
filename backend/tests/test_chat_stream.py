import asyncio
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
import main
import ai_groq


def database():
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{'id': 'repo'}]
    def rpc(name, payload):
        data = {'status': 'generate', 'session_id': 'session', 'user_message_id': 'message', 'claim_id': 'claim'} if name == 'begin_chat_request' else 'assistant'
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=data))
    db.rpc.side_effect = rpc
    return db


def drain(response):
    async def collect():
        return ''.join([item async for item in response.body_iterator])
    return asyncio.run(collect())


def test_stream_success_persists_atomically():
    db = database()
    with patch('main.get_supabase_client', return_value=db), patch('main.generate_embedding', return_value=[0.1]*768), patch('main.retrieve_context', return_value=('context', ['a.py:1-2'], [])), patch('main.generate_codebase_answer_stream', return_value=iter(['hello', ' world'])):
        events = drain(main.chat_codebase_stream('repo', main.ChatRequest(message='question', request_id='r'), user_id='u', token='t'))
    assert 'event: done' in events and 'hello world' in events
    assert sum(c.args[0] == 'complete_chat_request' for c in db.rpc.call_args_list) == 1


def test_stream_failure_and_empty_never_done():
    for provider in [iter([]), ai_groq.GroqError('Rate limited', 429)]:
        db = database()
        with patch('main.get_supabase_client', return_value=db), patch('main.generate_embedding', return_value=[0.1]*768), patch('main.retrieve_context', return_value=('', [], [])), patch('main.generate_codebase_answer_stream') as stream:
            if isinstance(provider, Exception): stream.side_effect = provider
            else: stream.return_value = provider
            events = drain(main.chat_codebase_stream('repo', main.ChatRequest(message='question'), user_id='u', token='t'))
        assert 'event: error' in events and 'event: done' not in events


def test_stream_retrieval_failure_never_generates_answer():
    db = database()
    with patch('main.get_supabase_client', return_value=db), patch('main.generate_embedding', side_effect=ValueError('private error')), patch('main.generate_codebase_answer_stream') as provider:
        events = drain(main.chat_codebase_stream('repo', main.ChatRequest(message='q'), user_id='u', token='t'))
    assert 'event: error' in events and 'private error' not in events
    provider.assert_not_called()


def test_concurrent_duplicate_returns_conflict():
    db = database()
    db.rpc.side_effect = None
    db.rpc.return_value.execute.return_value.data = {'status': 'busy'}
    with patch('main.get_supabase_client', return_value=db), pytest.raises(HTTPException) as exc:
        main.chat_codebase_stream('repo', main.ChatRequest(message='q', request_id='r'), user_id='u', token='t')
    assert exc.value.status_code == 409


def test_reply_replay_uses_anchor():
    db = database()
    with patch('main._existing_reply_for', return_value={'id': 'answer', 'content': 'saved', 'citations': ['a.py']}), patch('main.get_supabase_client', return_value=db), patch('main.generate_embedding') as embedding:
        db.rpc.side_effect = lambda name, payload: SimpleNamespace(execute=lambda: SimpleNamespace(data={'status':'replay','session_id':'s','user_message_id':'m','claim_id':'c'}))
        events = drain(main.chat_codebase_stream('repo', main.ChatRequest(message='q', request_id='r'), user_id='u', token='t'))
    assert 'saved' in events and 'event: done' in events
    embedding.assert_not_called()


@pytest.mark.parametrize('lines', [[], ['data: {bad}'], ['data: {"choices":[{"delta":{},"finish_reason":"stop"}]}','data: [DONE]'], ['data: {"choices":[{"delta":{"content":"partial"}}]}']])
def test_provider_stream_malformed_empty_and_interrupted(lines):
    client = MagicMock()
    response = client.send.return_value
    response.status_code = 200
    response.iter_lines.return_value = iter(lines)
    with patch('ai_groq.httpx.Client', return_value=client), patch('ai_groq._headers', return_value={}), pytest.raises(ai_groq.GroqError):
        list(ai_groq.generate_codebase_answer_stream([]))
    response.close.assert_called_once()
    client.close.assert_called_once()


@pytest.mark.parametrize('status',[401,403,429,500,503])
def test_groq_http_failure_is_safe_and_closes_stream(status):
    client=MagicMock();response=client.send.return_value
    response.status_code=status;response.read.return_value=b'sensitive provider detail'
    with patch('ai_groq.httpx.Client',return_value=client),patch('ai_groq._headers',return_value={}),pytest.raises(ai_groq.GroqError) as failure:
        list(ai_groq.generate_codebase_answer_stream([]))
    assert 'sensitive' not in failure.value.message
    response.close.assert_called_once();client.close.assert_called_once()
    assert client.send.call_count==1
