import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { openFileDatabase, initializeDatabase, run } from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { seedExpandedDemo } from '../lib/erp/expanded-demo';
import { createHandler } from '../lib/erp/http';

const origin = 'http://localhost';
const browser = new Window({ url: origin });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'Node',
  'MutationObserver',
  'Event',
  'KeyboardEvent',
])
  Object.defineProperty(globalThis, key, {
    value: (browser as unknown as Record<string, unknown>)[key],
    configurable: true,
  });
Object.defineProperty(globalThis, 'navigator', {
  value: browser.navigator,
  configurable: true,
});
Object.defineProperty(globalThis, 'FormData', {
  value: browser.FormData,
  configurable: true,
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup, within } =
  await import('@testing-library/react');
const { ErpWorkspace } = await import('../components/erp/workspace');

void test('seeded workspaces render mixed legacy and structured history in the compact preview', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'activity-history-ui-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  const originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'History-Preview-1234');
    await seedExpandedDemo(db, origin, { ERP_EXPANDED_DEMO: 'true' });
    for (const [id, note] of [
      [
        'ss49-sample-priority-activity-0-0',
        'School improvement priority and officer follow-up recorded.',
      ],
      [
        'ss49-sample-repair-activity-0-1',
        'Legacy maintenance inspection note.',
      ],
      ['ss49-sample-inspection-0-1-activity', 'Legacy school visit note.'],
    ])
      await run(db, 'UPDATE school_activity SET note=? WHERE id=?', note, id);
    await run(
      db,
      "INSERT INTO school_activity VALUES ('legacy-loan-note','school-a','library.a','ss49-sample-book-0-0-copy-0-loan','library issue',?,?)",
      'Legacy library circulation note.',
      new Date().toISOString(),
    );
    await run(
      db,
      "INSERT INTO school_activity VALUES ('structured-priority-note','school-a','commissioner','ss49-sample-priority-0-0','municipal progress',?,?)",
      JSON.stringify({
        note: 'Structured officer progress note.',
        before: { status: 'assigned' },
        after: { status: 'in-progress' },
      }),
      new Date().toISOString(),
    );
    const handler = createHandler(db, origin);
    let cookie = '';
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) =>
      handler(
        new Request(
          new URL(
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
            origin,
          ),
          {
            ...init,
            headers: {
              ...Object.fromEntries(new Headers(init?.headers)),
              cookie,
              ...(init?.method === 'POST' ? { origin } : {}),
            },
          },
        ),
      );
    for (const [username, section, note] of [
      [
        'commissioner',
        'Municipal priorities',
        'School improvement priority and officer follow-up recorded.',
      ],
      ['officer.a', 'Inspections', 'Legacy school visit note.'],
      [
        'support.a',
        'My maintenance work',
        'Legacy maintenance inspection note.',
      ],
      ['library.a', 'Issue & returns', 'Legacy library circulation note.'],
    ]) {
      cleanup();
      const login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'History-Preview-1234' }),
        }),
      );
      assert.equal(login.status, 200);
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      render(<ErpWorkspace initial={{ compactPreview: true }} />);
      const navigation = within(
        await screen.findByRole('navigation', { name: 'School workspace' }),
      );
      fireEvent.click(navigation.getByRole('button', { name: section }));
      await screen.findAllByText(note, { exact: false }, { timeout: 5000 });
      if (username === 'commissioner')
        assert.ok(
          screen.getByText('Structured officer progress note.', {
            exact: false,
          }),
        );
    }
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
    browser.close();
  }
});
