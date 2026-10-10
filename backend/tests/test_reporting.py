import json
from reporting import display_health, indexing_coverage, unique_graph_edges


def test_legacy_default_scores_are_not_presented_as_measured():
    legacy = {'overall_score': 80, 'testing_score': 80, 'breakdown': {'testing': 'Default report loaded.'}}
    result = display_health(legacy)
    assert result['overall_score'] is None and result['testing_score'] is None
    assert legacy['overall_score'] == 80
    measured = {'overall_score': 0, 'breakdown': {'method': 'Source rules'}}
    assert display_health(measured)['overall_score'] == 0


def test_completed_legacy_scan_does_not_imply_indexing_or_verified_coverage():
    assert indexing_coverage({'status': 'completed', 'stages': {}})['status'] == 'NOT VERIFIED'
    assert indexing_coverage({'status': 'completed', 'current_step': '{broken'})['status'] == 'NOT VERIFIED'


def test_coverage_uses_persisted_metrics_and_preserves_partial_states():
    embed = {'status': 'completed', 'chunks_expected': 3, 'chunks_indexed': 3, 'chunks_failed': 0}
    assert indexing_coverage({'current_step': json.dumps({'embed': embed})})['status'] == 'COMPLETE'
    embed['chunks_indexed'] = 2
    assert indexing_coverage({'stages': {'embed': embed}})['status'] == 'PARTIAL'
    embed['status'] = 'failed'
    assert indexing_coverage({'stages': {'embed': embed}})['status'] == 'FAILED'


def test_legacy_graph_edges_are_deduplicated_without_mutating_saved_data():
    edges = [{'id': 'a:b', 'source': 'a', 'target': 'b'},
             {'id': 'a:b', 'source': 'a', 'target': 'b'},
             {'id': 'b:c', 'source': 'b', 'target': 'c'}]
    assert len(unique_graph_edges(edges)) == 2
    assert len(edges) == 3
