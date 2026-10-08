import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStages, legacyStages, stageView } from '../src/utils/scanStages.ts';

test('failure and unknown statuses cannot imply successful stages', () => {
  for (const status of ['failed', 'partial', 'cancelled', 'unknown', 'none']) {
    assert.ok(Object.values(legacyStages(status)).every(stage => stage.status !== 'completed'));
  }
});
test('real partial stages survive parsing', () => {
  const stages = parseStages({ stages: { embed: { status: 'partial', progress: 82 } } });
  assert.equal(stages.embed.status, 'partial');
  assert.equal(stageView(stages.embed).text, 'Partial');
});
test('legacy malformed stage JSON cannot produce success', () => {
  const stages = parseStages({ current_step: '{broken', status: 'failed' });
  assert.ok(Object.values(stages).every(stage => stage.status !== 'completed'));
});
test('completed persisted stages are preserved', () => {
  assert.equal(parseStages({ current_step: '{"clone":{"status":"completed"}}' }).clone.status, 'completed');
});
