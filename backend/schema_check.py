"""Read-only schema contract checks; never return credentials or source rows."""
REQUIRED_COLUMNS = {
    'repositories': 'id,user_id,default_branch,scan_commit',
    'repository_scans': 'id,stages,heartbeat_at,cancel_requested',
    'repository_files': 'id,repository_id,file_path,hash',
    'code_chunks': 'id,line_start,line_end,embedding_model',
    'chat_messages': 'id,reply_to',
    'chat_requests': 'id,status,request_id',
    'security_reports': 'id,scope',
    'health_scores': 'id,testing_score,performance_score,breakdown',
}


def verify_schema(client):
    failures = []
    for table, columns in REQUIRED_COLUMNS.items():
        try:
            client.table(table).select(columns).limit(0).execute()
        except Exception as exc:
            failures.append({'table': table, 'code': str(getattr(exc, 'code', type(exc).__name__))})
    return failures


if __name__ == '__main__':
    import json
    from database import get_supabase_client
    try:
        failures = verify_schema(get_supabase_client())
        print(json.dumps({'schema': 'FAIL' if failures else 'PASS', 'failures': failures}))
        raise SystemExit(1 if failures else 0)
    except Exception as exc:
        print(json.dumps({'schema': 'FAIL', 'error_type': type(exc).__name__}))
        raise SystemExit(1) from None
