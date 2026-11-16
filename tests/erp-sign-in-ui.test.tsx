import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { openFileDatabase, initializeDatabase } from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
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

void test('professional sign-in retains workspace selection, credential errors and authenticated role routing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'erp-sign-in-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  const originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'SignIn-Review-1234');
    const handler = createHandler(db, origin);
    let cookie = '';
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const response = await handler(
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
      if (response.headers.has('set-cookie'))
        cookie = response.headers.get('set-cookie')!.split(';')[0];
      return response;
    };
    render(<ErpWorkspace initial={{}} />);
    await screen.findByRole('heading', { name: 'Sign in', level: 1 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Workspace' }), {
      target: { value: 'teacher.a' },
    });
    assert.equal(
      (screen.getByLabelText('Username') as HTMLInputElement).value,
      'teacher.a',
    );
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Incorrect-1234' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Sign in' }).closest('form')!,
    );
    assert.match(
      (await screen.findByRole('alert')).textContent ?? '',
      /Invalid username or password/,
    );
    await waitFor(() =>
      assert.ok(
        !(screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement)
          .disabled,
      ),
    );
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'SignIn-Review-1234' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Sign in' }).closest('form')!,
    );
    await screen.findByRole('heading', { name: 'My Day', level: 1 });
    const navigation = within(
      screen.getByRole('navigation', { name: 'School workspace' }),
    );
    assert.ok(navigation.getByRole('button', { name: 'Attendance register' }));
    assert.equal(
      navigation.queryByRole('button', { name: 'School setup' }),
      null,
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
    browser.close();
  }
});
