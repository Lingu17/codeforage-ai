"""Present persisted reports without inventing measurements for legacy records."""
import json


def unique_graph_edges(edges):
    """Repeated source imports represent one graph edge, including legacy reports."""
    return list({edge['id']: edge for edge in edges}.values())


def display_health(report):
    if not report:
        return {}
    evidence = report.get('breakdown')
    if isinstance(evidence, dict) and evidence.get('method'):
        return report
    return {**report, **{name: None for name in (
        'overall_score', 'architecture_score', 'security_score',
        'maintainability_score', 'testing_score', 'performance_score')},
        'breakdown': {'status': 'unavailable', 'confidence': 'unavailable',
                      'method': 'This legacy report has no measurement evidence. Run a new scan to calculate source health.'}}


def indexing_coverage(job):
    stages = job.get('stages')
    if not isinstance(stages, dict) or not stages:
        try:
            stages = json.loads(job.get('current_step') or '{}')
        except (ValueError, TypeError):
            stages = {}
    embed = stages.get('embed', {}) if isinstance(stages, dict) else {}
    if not isinstance(embed, dict):
        embed = {}
    coverage = {k: embed.get(k) for k in ('files_discovered', 'files_indexed',
        'chunks_expected', 'chunks_indexed', 'chunks_failed', 'coverage_percentage')}
    state = embed.get('status')
    coverage['status'] = {'partial': 'PARTIAL', 'failed': 'FAILED', 'cancelled': 'CANCELLED',
                          'running': 'INDEXING'}.get(state, 'NOT VERIFIED')
    if state == 'completed' and isinstance(coverage['chunks_expected'], int) and coverage['chunks_expected'] > 0:
        coverage['status'] = 'COMPLETE' if coverage['chunks_indexed'] == coverage['chunks_expected'] and coverage['chunks_failed'] == 0 else 'PARTIAL'
    return coverage
