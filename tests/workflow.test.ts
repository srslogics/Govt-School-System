import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accounts, canonicalSession } from '../lib/demo-accounts';
import {
  emptyState,
  applyCommand,
  validState,
  visibleRequests,
  allowedTransitions,
} from '../lib/school-workflow';
const account = (id: string) => canonicalSession({ userId: id })!;
void test('School request → assigned field review → district decision → school completion survives JSON reload', () => {
  let s = emptyState();
  const head = account('headmaster'),
    field = account('parseoni.officer'),
    district = account('district.admin');
  s = applyCommand(s, head, {
    kind: 'create',
    schoolId: 'parseoni',
    category: 'Infrastructure',
    title: 'Sample classroom repairs',
    description: 'Inspect the sample classroom roof.',
  });
  const id = s.requests[0].id;
  s = applyCommand(s, head, {
    kind: 'transition',
    id,
    status: 'Submitted',
    remarks: 'Submitted for field review.',
  });
  assert.equal(visibleRequests(s, field).length, 1);
  assert.equal(visibleRequests(s, account('field.officer')).length, 0);
  s = applyCommand(s, field, {
    kind: 'transition',
    id,
    status: 'Under review',
    remarks: 'Sample site review recorded.',
  });
  assert.throws(
    () =>
      applyCommand(s, field, {
        kind: 'transition',
        id,
        status: 'Approved',
        remarks: 'Attempt',
      }),
    /not permitted/,
  );
  s = applyCommand(s, district, {
    kind: 'transition',
    id,
    status: 'Approved',
    remarks: 'Approved for demonstration follow-up.',
  });
  assert.equal(visibleRequests(s, head)[0].status, 'Approved');
  s = applyCommand(s, head, {
    kind: 'transition',
    id,
    status: 'Closed',
    remarks: 'Completion acknowledged by the school.',
  });
  const restored = JSON.parse(JSON.stringify(s));
  assert(validState(restored));
  assert.equal(restored.requests[0].history.length, 5);
  assert.equal(restored.requests[0].status, 'Closed');
});
void test('Return and resubmission, required remarks and stale duplicate decisions', () => {
  const head = account('headmaster'),
    district = account('district.admin');
  let s = applyCommand(emptyState(), head, {
    kind: 'create',
    schoolId: 'parseoni',
    category: 'Staffing',
    title: 'Sample vacancy',
    description: 'Supporting information',
  });
  const id = s.requests[0].id;
  s = applyCommand(s, head, {
    kind: 'transition',
    id,
    status: 'Submitted',
    remarks: 'Review please',
  });
  s = applyCommand(s, district, {
    kind: 'transition',
    id,
    status: 'Returned',
    remarks: 'Add supporting details',
  });
  assert.deepEqual(allowedTransitions(s.requests[0], head), ['Submitted']);
  assert.throws(() =>
    applyCommand(s, head, {
      kind: 'transition',
      id,
      status: 'Submitted',
      remarks: '',
    }),
  );
  s = applyCommand(s, head, {
    kind: 'transition',
    id,
    status: 'Submitted',
    remarks: 'Details added',
  });
  s = applyCommand(s, district, {
    kind: 'transition',
    id,
    status: 'Under review',
    remarks: 'Reviewed',
  });
  s = applyCommand(s, district, {
    kind: 'transition',
    id,
    status: 'Rejected',
    remarks: 'Reason recorded',
  });
  assert.throws(() =>
    applyCommand(s, district, {
      kind: 'transition',
      id,
      status: 'Approved',
      remarks: 'Duplicate',
    }),
  );
});
void test('Canonical sessions discard injected role and assignment; command actor validated', () => {
  const value = canonicalSession({
    userId: 'parent',
    role: 'Municipal Commissioner',
    app: 'executive',
  });
  assert.equal(value?.app, 'community');
  assert(!('password' in value!));
  assert.equal(canonicalSession(null), null);
  assert.throws(() =>
    applyCommand(
      emptyState(),
      { ...account('parent'), app: 'executive' },
      {
        kind: 'create',
        schoolId: 'parseoni',
        category: 'Grant',
        title: 'x',
        description: 'x',
      },
    ),
  );
});
void test('Actions persist remarks and cannot invent district approval privileges', () => {
  const a = account('headmaster');
  assert.throws(() =>
    applyCommand(emptyState(), a, {
      kind: 'action',
      reference: 'REF-1',
      title: 'Sample',
      app: 'school',
      remarks: '',
      status: 'Submitted',
    }),
  );
  const s = applyCommand(emptyState(), a, {
    kind: 'action',
    reference: 'REF-1',
    title: 'Sample inspection',
    app: 'school',
    remarks: 'Evidence noted',
    status: 'Submitted',
  });
  assert.equal(
    JSON.parse(JSON.stringify(s)).actions[0].remarks,
    'Evidence noted',
  );
  assert.throws(() =>
    applyCommand(s, a, {
      kind: 'action',
      reference: 'REF-2',
      title: 'Approve',
      app: 'school',
      remarks: 'Test',
      status: 'Approved',
    }),
  );
});
void test('Malformed records and invalid scope are rejected', () => {
  assert(!validState(null));
  assert(!validState({ ...emptyState(), requests: [{}] }));
  assert.throws(() =>
    applyCommand(emptyState(), account('headmaster'), {
      kind: 'create',
      schoolId: 'hingna',
      category: 'Grant',
      title: 'x',
      description: 'x',
    }),
  );
  assert.equal(accounts.length, 8);
});
