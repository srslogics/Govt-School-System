import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const browser = new Window({ url: 'http://localhost/' });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'HTMLButtonElement',
  'Node',
  'MutationObserver',
  'Event',
  'KeyboardEvent',
  'StorageEvent',
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
const { render, screen, fireEvent, waitFor, cleanup } =
  await import('@testing-library/react');
const { LearningPanel } = await import('../components/erp/learning');
const { PortalPanel } = await import('../components/erp/portal');
const { createHandler } = await import('../lib/erp/http');
const { openFileDatabase, initializeDatabase, one, run } =
  await import('../lib/erp/database');
const { seedFictionalSchools } = await import('../lib/erp/seed');
const { seedLearningDemo } = await import('../lib/erp/learning-demo');
const { workspace } = await import('../lib/erp/attendance');
const { todayInNagpur } = await import('../lib/erp/model');
const { mkdtempSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const path = await import('node:path');
import type { Account } from '../lib/erp/model';
const origin = 'http://localhost';
void test('parent screens expose four sections, scoped reports, truthful empty attendance and saved homework completion', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'learning-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite'));
  const originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'LearningUI-Test-1234');
    await seedLearningDemo(db);
    const handler = createHandler(db, origin);
    const login = await handler(
      new Request(origin + '/api/erp/login', {
        method: 'POST',
        headers: { origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'parent.a',
          password: 'LearningUI-Test-1234',
        }),
      }),
    );
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) =>
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
    const parent = await one<Account>(
      db,
      "SELECT id,username,name,role FROM account WHERE id='parent.a'",
    );
    assert(parent);
    const parentWorkspace = await workspace(db, parent);
    const date = todayInNagpur();
    render(<PortalPanel workspace={parentWorkspace} date={date} />);
    await screen.findByRole('heading', {
      name: 'Sample learner A-1',
    });
    for (const name of ['Home', 'Attendance', 'Academics', 'Homework'])
      assert(screen.getByRole('button', { name }));
    assert(!screen.queryByText('Sample learner B-1', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Attendance' }));
    await screen.findByRole('heading', {
      name: `Attendance calendar · ${date.slice(0, 7)}`,
    });
    assert(screen.getByLabelText(`${date}: Not reported`));
    fireEvent.click(screen.getByRole('button', { name: 'Academics' }));
    await screen.findByRole('heading', {
      name: 'Subject progress',
    });
    assert(
      screen.getByRole('heading', {
        name: 'Published report cards',
      }),
    );
    assert(
      screen.getByText(
        'Total of published subjects: 243/300. 3 subjects included.',
        { exact: true },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Homework' }));
    await screen.findByRole('heading', {
      name: 'Fictional demo: everyday maths',
    });
    fireEvent.click(
      screen.getByText('Report homework completion', { exact: true }),
    );
    fireEvent.change(
      screen.getByLabelText('Completion note', { exact: true }),
      { target: { value: 'All five examples completed with an explanation.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send to teacher' }));
    await screen.findByText('Completion reported to the teacher.', {});
    await waitFor(async () =>
      assert.equal(
        (
          await one<{ note: string }>(
            db,
            "SELECT note FROM homework_submission WHERE student_id='class-a-student-1'",
          )
        )?.note,
        'All five examples completed with an explanation.',
      ),
    );
    cleanup();
    // A draft remains invisible; principals have a working publish interaction.
    await run(
      db,
      "UPDATE assessment SET published=0 WHERE id='demo-a-Mathematics'",
    );
    const principal = await one<Account>(
      db,
      "SELECT id,username,name,role FROM account WHERE id='principal.a'",
    );
    assert(principal);
    const principalLogin = await handler(
      new Request(origin + '/api/erp/login', {
        method: 'POST',
        headers: { origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'principal.a',
          password: 'LearningUI-Test-1234',
        }),
      }),
    );
    const principalCookie = principalLogin.headers
      .get('set-cookie')!
      .split(';')[0];
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) =>
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
              cookie: principalCookie,
              ...(init?.method === 'POST' ? { origin } : {}),
            },
          },
        ),
      );
    render(
      <LearningPanel
        workspace={await workspace(db, principal)}
        date={date}
        initialView="academics"
      />,
    );
    await screen.findByRole('button', {
      name: 'Publish to family',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish to family' }));
    await screen.findByText('Result published to the linked family.', {});
    assert.equal(
      (
        await one<{ published: number }>(
          db,
          "SELECT published FROM assessment WHERE id='demo-a-Mathematics'",
        )
      )?.published,
      1,
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
