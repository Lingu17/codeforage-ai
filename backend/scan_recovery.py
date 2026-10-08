"""Owner-scoped stale scan recovery; no automatic replay of stored credentials."""
from datetime import datetime, timezone

ACTIVE_STATUSES = ('queued', 'cloning', 'scanning', 'embedding', 'analyzing')


def recover_stale_scan(db, job, *, now=None):
    now = now or datetime.now(timezone.utc)
    stamp = job.get('heartbeat_at') or job.get('started_at')
    if job.get('status') not in ACTIVE_STATUSES or not stamp:
        return job
    try:
        last_seen = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return job
    if (now - last_seen).total_seconds() <= 300:
        return job
    stages = {key: dict(value) for key, value in (job.get('stages') or {}).items()}
    for stage in stages.values():
        if stage.get('status') == 'running':
            stage.update(status='failed', error='Worker interrupted; retry is available.')
    update = {'status': 'failed', 'completed_at': now.isoformat(), 'stages': stages,
              'error_message': 'Scan interrupted. Retry the scan; valid indexed files are reused.'}
    # A concurrent heartbeat or stage transition must win over this stale snapshot.
    field = 'heartbeat_at' if job.get('heartbeat_at') else 'started_at'
    result = db.table('repository_scans').update(update).eq('id', job['id']).eq('status', job['status']).eq(field, stamp).execute()
    if result.data:
        return {**job, **update}
    current = db.table('repository_scans').select('*').eq('id', job['id']).limit(1).execute().data
    return current[0] if current else job
