import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { openFileDatabase, initializeDatabase } from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { seedLearningDemo } from '../lib/erp/learning-demo';
import { seedTeacherDemo } from '../lib/erp/teacher-demo';
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
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import('@testing-library/react');
const { ErpWorkspace } = await import('../components/erp/workspace');

void test('unified workspace navigation retains role scope, route selection, search and keyboard drawer controls', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'erp-navigation-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  const originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Navigation-Test-1234');
    await seedLearningDemo(db);
    await seedTeacherDemo(db);
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
    async function mount(username: string, compactPreview?: boolean) {
      cleanup();
      const result = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'Navigation-Test-1234' }),
        }),
      );
      assert.equal(result.status, 200);
      cookie = result.headers.get('set-cookie')!.split(';')[0];
      render(
        <ErpWorkspace
          initial={{
            compactPreview,
            showLayoutComparison: compactPreview === true,
          }}
        />,
      );
      await screen.findByRole('navigation', { name: 'School workspace' });
      return within(
        screen.getByRole('navigation', { name: 'School workspace' }),
      );
    }
    const parent = await mount('parent.a');
    assert.ok(document.querySelector('.erp-compact-preview'));
    assert.equal(screen.queryByText('Compact layout preview'), null);
    await screen.findByRole('heading', { name: 'Sample learner A-1' });
    assert.equal(
      screen.queryByRole('navigation', { name: 'School community sections' }),
      null,
    );
    assert.equal(parent.queryByRole('button', { name: 'Marks Entry' }), null);
    assert.equal(
      parent.queryByRole('button', { name: 'Attendance register' }),
      null,
    );
    fireEvent.click(parent.getByRole('button', { name: 'Academics' }));
    await screen.findByRole('heading', {
      name: 'Published report cards',
    });
    assert.equal(
      parent
        .getByRole('button', { name: 'Academics' })
        .getAttribute('aria-current'),
      'page',
    );
    fireEvent.change(screen.getByLabelText('Find a tool'), {
      target: { value: 'library' },
    });
    assert.equal(parent.getAllByRole('button').length, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear tool search' }));
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    assert.equal(menu.getAttribute('aria-expanded'), 'true');
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(
      document.activeElement?.getAttribute('aria-label'),
      'Close navigation',
    );
    const logout = screen.getByRole('button', { name: 'Sign out' });
    logout.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    assert.equal(
      document.activeElement?.getAttribute('aria-label'),
      'Close navigation',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      assert.equal(menu.getAttribute('aria-expanded'), 'false'),
    );
    assert.equal(document.activeElement, menu);
    assert.equal(document.body.style.overflow, '');
    fireEvent.click(menu);
    fireEvent.click(parent.getByRole('button', { name: 'School notices' }));
    assert.equal(menu.getAttribute('aria-expanded'), 'false');
    const teacher = await mount('teacher.a');
    await screen.findByRole('heading', { name: 'My Day', level: 1 });
    fireEvent.click(teacher.getByRole('button', { name: 'Timetable' }));
    await screen.findByRole('heading', { name: 'Weekly timetable' });
    fireEvent.click(
      teacher.getByRole('button', { name: 'Attendance register' }),
    );
    await screen.findByRole('heading', { name: 'Class attendance', level: 1 });
    const commissioner = await mount('commissioner');
    await screen.findByRole('heading', {
      name: 'Municipal overview',
      level: 1,
    });
    assert.equal(
      screen.queryByRole('navigation', {
        name: 'Education oversight sections',
      }),
      null,
    );
    fireEvent.click(
      commissioner.getByRole('button', { name: 'School comparison' }),
    );
    await screen.findByRole('heading', { name: 'School comparison', level: 1 });
    assert.equal(
      commissioner.queryByRole('button', { name: 'Attendance register' }),
      null,
    );

    const compactTeacher = await mount('teacher.a', true);
    await screen.findByRole('heading', { name: 'My Day', level: 1 });
    fireEvent.click(compactTeacher.getByRole('button', { name: 'Timetable' }));
    await screen.findByRole('heading', { name: 'Weekly timetable' });
    assert.ok(document.querySelector('.erp-compact-preview'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Compare current layout' }),
    );
    assert.equal(document.querySelector('.erp-compact-preview'), null);
    assert.ok(screen.getByRole('heading', { name: 'Weekly timetable' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to compact preview' }),
    );
    assert.ok(document.querySelector('.erp-compact-preview'));
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
    browser.close();
  }
});
