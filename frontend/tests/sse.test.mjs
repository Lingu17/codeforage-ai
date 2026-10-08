import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSEParser } from '../src/utils/sse.ts';

test('SSE handles split UTF-8, boundaries, and multiline data', () => {
  const events = [];
  const parser = createSSEParser((event, data) => events.push([event, data.join('\n')]));
  const bytes = new TextEncoder().encode('event: delta\ndata: hello 😀\ndata: world\n\nevent: done\ndata: {}\n\n');
  for (const byte of bytes) parser.feed(new Uint8Array([byte]));
  assert.deepEqual(events, [['delta','hello 😀\nworld'],['done','{}']]);
});
test('SSE error remains an error event', () => {
  const events = [];
  const parser = createSSEParser((event, data) => events.push([event, data.join('\n')]));
  parser.feed(new TextEncoder().encode('event: error\ndata: {"message":"failed"}\n\n'));
  assert.equal(events[0][0], 'error');
  assert.equal(events.length, 1);
});
test('SSE flush handles a final frame without creating a done event', () => {
  const events = [];
  const parser = createSSEParser((event) => events.push(event));
  parser.feed(new TextEncoder().encode('event: delta\ndata: unfinished'));
  parser.feed(new Uint8Array(), true);
  assert.deepEqual(events, ['delta']);
});
