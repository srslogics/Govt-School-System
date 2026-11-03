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
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import('@testing-library/react');

const { DemoAuthGate } = await import('../components/demo-auth');
const { SchoolRecordsProvider } = await import('../components/school-records');
const { WorkflowDesk } = await import('../components/workflow-desk');
const { canonicalSession } = await import('../lib/demo-accounts');
const { STORE_KEY } = await import('../lib/school-workflow');
const memory = new Map<string, string>();
let blocked = false;
const storage = {
  getItem: (key: string) => {
    if (blocked) throw Error('Blocked');
    return memory.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (blocked) throw Error('Blocked');
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    if (blocked) throw Error('Blocked');
    memory.delete(key);
  },
};
Object.defineProperty(browser, 'localStorage', {
  value: storage,
  configurable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
});
const mount = (view = 'Requests') =>
  render(
    <DemoAuthGate>
      <SchoolRecordsProvider>
        <WorkflowDesk view={view} />
      </SchoolRecordsProvider>
    </DemoAuthGate>,
  );
async function profile(id: string, view = 'Requests') {
  cleanup();
  memory.set(
    'shikshan-setu-demo-session',
    JSON.stringify(canonicalSession({ userId: id })),
  );
  mount(view);
  await screen.findByRole('heading', { level: 1 });
}
void test('UI create/submit, refresh, officer review, decision and school completion retain remarks', async () => {
  await profile('headmaster');
  fireEvent.click(screen.getByRole('button', { name: 'New school request' }));
  let dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Subject'), {
    target: { value: 'Sample roof repair' },
  });
  fireEvent.change(within(dialog).getByLabelText('Request details'), {
    target: { value: 'Sample supporting details' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    assert(memory.get(STORE_KEY)?.includes('Sample roof repair')),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
  dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Remarks required'), {
    target: { value: 'Please review this proposal' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Submit request' }),
  );
  assert.equal(
    JSON.parse(memory.get(STORE_KEY)!).requests[0].status,
    'Submitted',
  );
  await profile('parseoni.officer');
  fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
  dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Remarks required'), {
    target: { value: 'Site review complete' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Record review' }),
  );
  assert.equal(
    JSON.parse(memory.get(STORE_KEY)!).requests[0].status,
    'Under review',
  );
  await profile('district.admin');
  fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
  dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Remarks required'), {
    target: { value: 'Approved with recorded follow-up' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approved' }));
  await profile('headmaster');
  fireEvent.click(screen.getByRole('button', { name: 'Open request' }));
  dialog = screen.getByRole('dialog');
  assert(within(dialog).getByText('Approved with recorded follow-up'));
  fireEvent.change(within(dialog).getByLabelText('Remarks required'), {
    target: { value: 'School confirms completion' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Confirm completion' }),
  );
  assert.equal(JSON.parse(memory.get(STORE_KEY)!).requests[0].status, 'Closed');
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(screen.queryByRole('dialog'), null);
  await profile('field.officer');
  assert.equal(screen.queryByRole('button', { name: 'Open request' }), null);
});
void test('Blocked storage permits sign-in and a temporary workspace', async () => {
  cleanup();
  blocked = true;
  mount();
  await screen.findByRole('heading', { name: 'Sign in' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { level: 1 });
  assert(
    screen
      .getAllByRole('status')
      .some(
        (el) =>
          el.textContent?.includes('Storage') ||
          el.textContent?.includes('storage'),
      ),
  );
  cleanup();
  blocked = false;
});
void test('Corrupt saved records are preserved and block silent replacement', async () => {
  memory.set(STORE_KEY, '{broken');
  await profile('headmaster');
  assert(screen.getByText(/Existing text has been preserved/));
  fireEvent.click(screen.getByRole('button', { name: 'New school request' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Subject'), {
    target: { value: 'New request' },
  });
  fireEvent.change(within(dialog).getByLabelText('Request details'), {
    target: { value: 'Sample' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
  assert(within(dialog).getByRole('alert').textContent?.includes('recovery'));
  assert.equal(memory.get(STORE_KEY), '{broken');
  cleanup();
});

void test('Restoring a tampered profile uses canonical parent role', async () => {
  cleanup();
  memory.delete(STORE_KEY);
  memory.set(
    'shikshan-setu-demo-session',
    JSON.stringify({
      userId: 'parent',
      app: 'executive',
      role: 'Municipal Commissioner',
      name: 'Injected',
    }),
  );
  mount();
  await screen.findByRole('heading', { level: 1 });
  assert.equal(
    screen.queryByRole('button', { name: 'Reset demo records' }),
    null,
  );
  assert(screen.getByText(/Family & SMC/));
  cleanup();
});
