import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { openFileDatabase, initializeDatabase } from '../lib/erp/database';
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
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import('@testing-library/react');
const { ErpWorkspace } = await import('../components/erp/workspace');

void test('every role can navigate its professional workspaces and module tabs with seeded records', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'workbench-ui-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  const originalFetch = globalThis.fetch;
  let checked = 0;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Workbench-UI-1234');
    await seedExpandedDemo(db, origin, { ERP_EXPANDED_DEMO: 'true' });
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
    async function ready() {
      await waitFor(
        () => {
          assert.doesNotMatch(document.body.textContent ?? '', /Loading[\s…]/);
          assert.equal(screen.queryByRole('alert'), null);
        },
        { timeout: 10000 },
      );
    }
    for (const username of [
      'parent.a',
      'teacher.a',
      'principal.a',
      'office.a',
      'accounts.a',
      'library.a',
      'support.a',
      'officer.a',
      'commissioner',
      'admin',
    ]) {
      cleanup();
      const response = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'Workbench-UI-1234' }),
        }),
      );
      assert.equal(response.status, 200, username);
      cookie = response.headers.get('set-cookie')!.split(';')[0];
      render(<ErpWorkspace initial={{}} />);
      const navigation = within(
        await screen.findByRole('navigation', { name: 'School workspace' }),
      );
      await ready();
      assert.ok(document.querySelector('.erp-workbench'), username);
      const labels = navigation
        .getAllByRole('button')
        .map((button) => button.textContent!.trim());
      for (const label of labels) {
        const button = navigation.getByRole('button', {
          name: label,
        });
        fireEvent.click(button);
        await ready();
        assert.equal(
          button.getAttribute('aria-current'),
          'page',
          `${username}: ${label}`,
        );
        checked++;
        for (const name of [
          'School administration modules',
          'Library sections',
          'Education oversight sections',
        ]) {
          const tabs = screen.queryByRole('navigation', { name });
          if (!tabs) continue;
          const section = within(tabs);
          const choices = section
            .getAllByRole('button')
            .map((item) => item.textContent!.trim());
          for (const choice of choices) {
            fireEvent.click(
              within(screen.getByRole('navigation', { name })).getByRole(
                'button',
                { name: choice },
              ),
            );
            await ready();
            checked++;
          }
        }
      }
    }
    assert.ok(checked >= 80, `Only ${checked} pages checked`);
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
    browser.close();
  }
});
