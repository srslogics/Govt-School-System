import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readActivityNote } from '../lib/erp/activity-note';
void test('history notes preserve legacy text and decode both structured transition formats', () => {
  const note = 'School improvement priority and officer follow-up recorded.';
  assert.deepEqual(readActivityNote(note), { note, before: null, after: null });
  assert.deepEqual(
    readActivityNote(
      JSON.stringify({
        note,
        before: { status: 'assigned' },
        after: { status: 'in-progress' },
      }),
    ),
    { note, before: 'assigned', after: 'in-progress' },
  );
  assert.deepEqual(
    readActivityNote(
      JSON.stringify({ note, before: 'visited', after: 'responded' }),
    ),
    { note, before: 'visited', after: 'responded' },
  );
  assert.deepEqual(
    readActivityNote(
      JSON.stringify({ note, before: null, after: { status: 'assigned' } }),
    ),
    { note, before: null, after: 'assigned' },
  );
  assert.deepEqual(readActivityNote(JSON.stringify({ note })), {
    note,
    before: null,
    after: null,
  });
});
void test('unexpected or malformed history payloads cannot crash a workspace or invent transitions', () => {
  for (const raw of [
    '{broken',
    'null',
    '123',
    '[]',
    '{"before":42,"after":false}',
    '{"note":null,"after":{}}',
  ])
    assert.deepEqual(readActivityNote(raw), {
      note: raw,
      before: null,
      after: null,
    });
  assert.deepEqual(readActivityNote('"A saved note"'), {
    note: 'A saved note',
    before: null,
    after: null,
  });
});
