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

const { seedTeacherDemo } = await import('../lib/erp/teacher-demo');
void test('teacher My Day opens attendance, timetable, student profiles and saves a class marks grid', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'teacher-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite')),
    originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'TeacherUI-Test-1234');
    await seedLearningDemo(db);
    await seedTeacherDemo(db);
    const handler = createHandler(db, origin),
      login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'teacher.a',
            password: 'TeacherUI-Test-1234',
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
    const teacher = await one<Account>(
      db,
      "SELECT id,username,name,role FROM account WHERE id='teacher.a'",
    );
    assert(teacher);
    let opened = '';
    render(
      <PortalPanel
        workspace={await workspace(db, teacher)}
        date={todayInNagpur()}
        onOpenRegister={(id) => {
          opened = id;
        }}
      />,
    );
    await screen.findByRole('heading', { name: 'My Day' });
    for (const name of [
      'My Day',
      'Timetable',
      'Students',
      'Marks Entry',
      'School tasks',
    ])
      assert(screen.getByRole('button', { name }));
    fireEvent.click(screen.getByRole('button', { name: 'Open register' }));
    assert.equal(opened, 'class-a');
    fireEvent.click(screen.getByRole('button', { name: 'Timetable' }));
    await screen.findByRole('heading', { name: 'Weekly timetable' });
    await screen.findAllByText('Mathematics');
    assert(!screen.queryByText('Demo Teacher B'));
    fireEvent.click(screen.getByRole('button', { name: 'Students' }));
    await screen.findByRole('heading', { name: 'Student profiles' });
    await screen.findByRole('button', {
      name: 'Sample learner A-2 Class 5 · Section A · Roll 2',
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Sample learner A-2 Class 5 · Section A · Roll 2',
      }),
    );
    assert(screen.getByRole('heading', { name: 'Sample learner A-2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marks Entry' }));
    await screen.findByRole('heading', { name: 'Class marks entry' });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Mathematics' },
    });
    fireEvent.change(screen.getByLabelText('Assessment name'), {
      target: { value: 'Teacher UI test' },
    });
    fireEvent.change(screen.getByLabelText('Marks for Sample learner A-1'), {
      target: { value: '86' },
    });
    fireEvent.change(screen.getByLabelText('Feedback for Sample learner A-1'), {
      target: { value: 'Clear reasoning. Practise the last question.' },
    });
    fireEvent.change(screen.getByLabelText('Marks for Sample learner A-2'), {
      target: { value: '74' },
    });
    fireEvent.change(screen.getByLabelText('Feedback for Sample learner A-2'), {
      target: { value: 'Practise multiplication with examples.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft marks' }));
    await screen.findByText('2 draft results saved for principal publication.');
    await waitFor(async () =>
      assert.equal(
        (
          await one<{ score: number }>(
            db,
            "SELECT score FROM assessment WHERE student_id='class-a-student-1' AND exam='Teacher UI test'",
          )
        )?.score,
        86,
      ),
    );
    await screen.findByDisplayValue('86');
    fireEvent.change(screen.getByLabelText('Marks for Sample learner A-1'), {
      target: { value: '88' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft marks' }));
    await waitFor(async () =>
      assert.equal(
        (
          await one<{ score: number }>(
            db,
            "SELECT score FROM assessment WHERE student_id='class-a-student-1' AND exam='Teacher UI test'",
          )
        )?.score,
        88,
      ),
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('principal dashboard keeps attendance brief and opens school leadership workflows', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'principal-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite')),
    originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'PrincipalUI-Test-1234');
    await seedLearningDemo(db);
    await seedTeacherDemo(db);
    const handler = createHandler(db, origin),
      login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'principal.a',
            password: 'PrincipalUI-Test-1234',
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
    const teacher = await one<Account>(
      db,
      "SELECT id,username,name,role FROM account WHERE id='principal.a'",
    );
    assert(teacher);
    let opened = '';
    let reportOpened = false;
    render(
      <PortalPanel
        workspace={await workspace(db, teacher)}
        date={todayInNagpur()}
        onOpenRegister={(id) => {
          opened = id;
        }}
        onOpenReport={() => {
          reportOpened = true;
        }}
      />,
    );
    await screen.findByRole('region', { name: 'Brief attendance summary' });
    assert(screen.getByText(/0 present · 0 absent/));
    assert(!screen.queryByText('Demo Teacher B'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Full attendance report' }),
    );
    assert.equal(reportOpened, true);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open class register' })[0],
    );
    assert.equal(opened, 'class-a');
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
    await screen.findByRole('heading', { name: 'Staff & responsibilities' });
    await screen.findByText('Demo Teacher A');
    assert(!screen.queryByText('Demo Teacher B'));
    fireEvent.click(screen.getByRole('button', { name: 'Performance' }));
    await screen.findByRole('heading', { name: 'School academic performance' });
    assert(screen.getByRole('columnheader', { name: 'Draft results' }));
    fireEvent.click(screen.getByRole('button', { name: 'Student profiles' }));
    await screen.findByRole('heading', { name: 'Student profiles' });
    await screen.findByRole('button', {
      name: 'Sample learner A-1 Class 5 · Section A · Roll 1',
    });
    assert(!screen.queryByText('Sample learner B-1'));
    fireEvent.click(
      screen.getByRole('button', { name: 'School administration' }),
    );
    await screen.findByText('No staff attendance records yet');
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    change('Staff member', 'teacher.a');
    change('Details / purpose', 'Verified at morning assembly');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save staff attendance' }),
    );
    await screen.findByRole('heading', { name: 'Demo Teacher A' });
    assert(screen.getByText(/Verified at morning assembly/));
    fireEvent.click(screen.getByRole('button', { name: 'Staff leave' }));
    change('Reason', 'Personal appointment');
    fireEvent.click(screen.getByRole('button', { name: 'Save leave request' }));
    await screen.findByText(/Personal appointment/);
    assert(!screen.queryByText('Record principal decision'));
    fireEvent.click(screen.getByRole('button', { name: 'Admissions' }));
    change('Learner name', 'UI admitted learner');
    change('Guardian name', 'UI guardian');
    change('Guardian contact', 'Fictional contact');
    change('Requested class', 'class-a');
    change('Details / purpose', 'Documents checked');
    fireEvent.click(screen.getByRole('button', { name: 'Save application' }));
    await screen.findByRole('heading', { name: 'UI admitted learner' });
    change('Roll number (for admission)', '95');
    change('Decision note', 'Admission checked and approved');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save principal decision' }),
    );
    await screen.findByText(/Enrolled · Roll 95/);
    assert(
      await one(
        db,
        "SELECT id FROM enrolment WHERE class_id='class-a' AND roll='95'",
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Payroll' }));
    change('Staff member', 'teacher.a');
    change('Gross pay (₹)', '2000.10');
    change('Deductions (₹)', '100.05');
    change('Payroll preparation note', 'Salary prepared for review');
    fireEvent.click(screen.getByRole('button', { name: 'Save payroll draft' }));
    await screen.findByRole('heading', { name: 'Demo Teacher A' });
    await screen.findByText('Net ₹1,900.05');
    change('Decision note', 'Salary checked');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save principal decision' }),
    );
    await screen.findByText('approved');
    assert(!screen.queryByText('Revise payroll draft'));
    fireEvent.click(screen.getByRole('button', { name: 'Grants & expenses' }));
    change('Grant name', 'UI learning grant');
    change('Sanction reference', 'UI-SANCTION-1');
    change('Sanctioned amount (₹)', '1000');
    change('Details / purpose', 'Learning material allocation');
    fireEvent.click(screen.getByRole('button', { name: 'Save grant' }));
    await screen.findByRole('heading', { name: 'UI learning grant' });
    change('Expense amount (₹)', '200.25');
    change('Voucher reference', 'UI-VOUCHER-1');
    change('Expense purpose', 'Books for class 5');
    fireEvent.click(screen.getByRole('button', { name: 'Save grant expense' }));
    await screen.findByText('Remaining ₹799.75');
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
    change('Item name', 'UI chairs');
    change('Item code', 'UI-CHAIR');
    change('Unit', 'pieces');
    change('Opening quantity', '10');
    change('Opening stock note', 'Opening count verified');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save inventory item' }),
    );
    await screen.findByRole('heading', { name: 'UI chairs' });
    change('Stock movement', 'issue');
    change('Movement quantity', '3');
    change('Recipient / purpose', 'Class 5 room');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save stock movement' }),
    );
    await screen.findByText('Available 7 pieces');
    fireEvent.click(screen.getByRole('button', { name: 'School calendar' }));
    change('Event title', 'UI parent meeting');
    change('Details / purpose', 'Meet class teacher');
    change('Event audience', 'parents');
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await screen.findByRole('heading', { name: 'UI parent meeting' });
    change('Decision note', 'Postponed to next week');
    fireEvent.click(
      screen.getByRole('button', { name: 'Save principal decision' }),
    );
    await screen.findByText('cancelled');
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

const { OversightPanel } = await import('../components/erp/oversight');
void test('officer screens exchange inspection, escalation and circular responses with school and Commissioner', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'officer-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite')),
    originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'OfficerUI-Test-1234');
    const handler = createHandler(db, origin);
    let cookie = '';
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
    const as = async (username: string) => {
      cleanup();
      const login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'OfficerUI-Test-1234' }),
        }),
      );
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      const account = await one<Account>(
        db,
        'SELECT id,name,username,role FROM account WHERE username=?',
        username,
      );
      assert(account);
      render(
        <OversightPanel
          workspace={await workspace(db, account)}
          date={todayInNagpur()}
        />,
      );
      await screen.findByLabelText('Assigned school');
      await waitFor(() =>
        assert(!screen.queryByText('Loading assigned school oversight…')),
      );
    };
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const click = (name: string) =>
      fireEvent.click(screen.getByRole('button', { name }));
    await as('officer.a');
    assert(screen.getByRole('heading', { name: 'Schools needing attention' }));
    assert(!screen.queryByText('NMC Demo School B · Fictional'));
    click('School profiles');
    await screen.findByRole('heading', { name: 'School profiles' });
    assert(!screen.queryByText('Sample learner A-1'));
    click('Inspections');
    change('Visit purpose', 'UI quality visit');
    change('Inspection plan', 'Review classroom safety');
    click('Save planned inspection');
    await screen.findByRole('heading', { name: 'UI quality visit' });
    change('Inspection findings', 'Two desks need repair');
    change('Corrective action', 'Repair desks and report');
    click('Save inspection findings');
    await screen.findByText('visited');
    await as('principal.a');
    click('Inspections');
    await screen.findByRole('heading', { name: 'UI quality visit' });
    change('School corrective-action report', 'Desks repaired and checked');
    click('Report corrective action');
    await screen.findByText('responded');
    await as('officer.a');
    click('Inspections');
    await screen.findByRole('heading', { name: 'UI quality visit' });
    change('Decision remarks', 'Verified school correction');
    click('Save oversight decision');
    await screen.findByText('closed');
    await as('principal.a');
    change('Request title', 'UI infrastructure support');
    change('Request category', 'maintenance');
    change('Priority', 'high');
    change('School request details', 'Technical repair visit needed');
    click('Send school request');
    await screen.findByRole('heading', { name: 'UI infrastructure support' });
    await as('officer.a');
    click('School requests');
    await screen.findByRole('heading', { name: 'UI infrastructure support' });
    change('Officer review', 'Reviewed school requirement');
    click('Record officer review');
    await screen.findByText('under-review');
    change('Decision', 'escalated');
    change('Decision remarks', 'Needs Commissioner coordination');
    click('Save oversight decision');
    await screen.findByText('escalated');
    await as('commissioner');
    click('Escalated decisions');
    await screen.findByRole('heading', { name: 'UI infrastructure support' });
    change('Decision', 'resolved');
    change('Decision remarks', 'Technical team coordinated');
    click('Save oversight decision');
    await waitFor(async () =>
      assert.equal(
        (
          await one<{ status: string }>(
            db,
            "SELECT status FROM education_record WHERE kind='request' AND json_extract(data,'$.title')='UI infrastructure support'",
          )
        )?.status,
        'resolved',
      ),
    );
    await as('officer.a');
    click('Circulars & compliance');
    change('Circular title', 'UI safety circular');
    change('Circular instructions', 'Complete classroom safety checklist');
    change('Recipients', 'all');
    click('Publish circular');
    await screen.findByRole('heading', { name: 'UI safety circular' });
    await as('principal.a');
    click('Circulars & compliance');
    await screen.findByRole('heading', { name: 'UI safety circular' });
    change('Acknowledgement note', 'Received by school');
    click('Acknowledge circular');
    await screen.findByText('acknowledged');
    change('Compliance report', 'All classroom checks completed');
    click('Submit compliance report');
    await screen.findByText('reported');
    await as('officer.a');
    click('Circulars & compliance');
    await screen.findByRole('heading', { name: 'UI safety circular' });
    change('Decision remarks', 'Compliance verified');
    click('Save oversight decision');
    await screen.findByText('closed');
    assert(
      screen.getAllByText('All classroom checks completed', { exact: false })
        .length > 0,
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('Commissioner municipal dashboard compares schools and verifies assigned officer priorities', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'commissioner-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite')),
    originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'OfficerUI-Test-1234');
    const handler = createHandler(db, origin);
    let cookie = '';
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
    const as = async (username: string) => {
      cleanup();
      const login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'OfficerUI-Test-1234' }),
        }),
      );
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      const account = await one<Account>(
        db,
        'SELECT id,name,username,role FROM account WHERE username=?',
        username,
      );
      assert(account);
      render(
        <OversightPanel
          workspace={await workspace(db, account)}
          date={todayInNagpur()}
        />,
      );
      await screen.findByLabelText('Assigned school');
      await waitFor(() =>
        assert(!screen.queryByText('Loading assigned school oversight…')),
      );
    };
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const click = (name: string) =>
      fireEvent.click(screen.getByRole('button', { name }));
    await as('commissioner');
    assert(
      screen.getByRole('heading', { name: 'Municipal education overview' }),
    );
    const exportLink = screen.getByRole('link', {
      name: 'Export all schools summary CSV',
    });
    assert(exportLink.getAttribute('href')?.includes('format=csv'));
    click('School comparison');
    assert(screen.getByRole('heading', { name: 'School comparison' }));
    assert.equal(screen.getAllByRole('row').length, 3);
    change('Order schools by', 'coverage');
    click('Municipal priorities');
    change('Responsible education officer', 'officer.a');
    change('Priority title', 'UI municipal classroom action');
    change('Priority category', 'infrastructure');
    change('Urgency', 'high');
    change(
      'Commissioner instructions',
      'Coordinate classroom repairs and verify school readiness',
    );
    click('Save municipal assignment');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    await as('officer.a');
    click('Municipal priorities');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    change('Progress status', 'reported');
    change(
      'Officer progress report',
      'Repair work complete; school readiness checked',
    );
    click('Save officer progress');
    await screen.findByText('reported');
    await as('commissioner');
    click('Municipal priorities');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    change('Verification outcome', 'in-progress');
    change('Verification remarks', 'Confirm final safety check');
    click('Save municipal verification');
    await screen.findByText('in-progress');
    await as('officer.a');
    click('Municipal priorities');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    change('Progress status', 'reported');
    change('Officer progress report', 'Final safety check confirmed');
    click('Save officer progress');
    await screen.findByText('reported');
    await as('commissioner');
    click('Municipal priorities');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    change('Verification remarks', 'Completion verified');
    click('Save municipal verification');
    await waitFor(async () =>
      assert.equal(
        (
          await one<{ status: string }>(
            db,
            "SELECT status FROM municipal_priority WHERE title='UI municipal classroom action'",
          )
        )?.status,
        'closed',
      ),
    );
    change('Priority filter', 'closed');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    assert(screen.getByText('closed'));
    assert(!screen.queryByText('Verify officer report'));
    await as('principal.a');
    click('Municipal priorities');
    change('Priority filter', 'closed');
    await screen.findByRole('heading', {
      name: 'UI municipal classroom action',
    });
    assert(!screen.queryByText('Update assigned priority'));
    assert(
      !screen.queryByRole('button', { name: 'Save municipal assignment' }),
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('librarian catalogue and circulation UI supports overdue, renewal, return, repair and linked-family history', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'library-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite')),
    originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'OfficerUI-Test-1234');
    const handler = createHandler(db, origin);
    let cookie = '';
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
    const as = async (username: string) => {
      cleanup();
      const login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'OfficerUI-Test-1234' }),
        }),
      );
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      const account = await one<Account>(
        db,
        'SELECT id,name,username,role FROM account WHERE username=?',
        username,
      );
      assert(account);
      render(
        <PortalPanel
          workspace={await workspace(db, account)}
          date={todayInNagpur()}
        />,
      );
      await screen.findByRole('navigation', {
        name: 'School community sections',
      });
      if (username === 'library.a')
        await screen.findByLabelText('Library school');
    };
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const click = (name: string) =>
      fireEvent.click(screen.getByRole('button', { name }));
    const today = todayInNagpur(),
      past = new Date(today + 'T12:00:00Z');
    past.setUTCDate(past.getUTCDate() - 1);
    const yesterday = past.toISOString().slice(0, 10);
    await run(db, 'UPDATE class_section SET effective_on=?', yesterday);
    await run(db, 'UPDATE enrolment SET effective_on=?', yesterday);
    await as('library.a');
    await screen.findByRole('heading', { name: 'Library home' });
    click('Catalogue');
    await screen.findByText(
      'No catalogue titles match. Add a title, then add its physical copies.',
    );
    change('Catalogue code', 'UI-READ-1');
    change('Book title', 'UI reading book');
    change('Author', 'Fictional Author');
    change('Book category', 'Reading');
    change('Language', 'English');
    change('Shelf / location', 'Shelf A');
    click('Save catalogue title');
    await screen.findByRole('heading', { name: 'UI reading book' });
    change('Accession number', 'UI-ACC-1');
    change('Copy acquisition note', 'Opening library copy');
    click('Save book copy');
    await screen.findByText('1 available of 1 copies');
    const copy = await one<{ id: string }>(
      db,
      "SELECT id FROM library_copy WHERE accession='UI-ACC-1'",
    );
    assert(copy);
    click('Issue & returns');
    await screen.findByRole('option', {
      name: 'Sample learner A-1 · Class 5 · Section A · Roll 1',
    });
    change('Available book copy', copy.id);
    change('Student borrower', 'class-a-student-1');
    change('Issue date', yesterday);
    change('Due date', yesterday);
    change('Issue note', 'Reading practice for home');
    click('Issue selected book');
    await screen.findByText('Book issued.');
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    click('Overdue');
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    assert(screen.getByText('Overdue', { selector: 'span.erp-status' }));
    await as('parent.a');
    click('Library');
    await screen.findByRole('heading', { name: 'Your child’s library books' });
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    assert(!screen.queryByRole('button', { name: 'Save book return' }));
    assert(!screen.queryByText('Sample learner A-2'));
    await as('library.a');
    click('Overdue');
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    change('Renewal reason', 'Extra reading time approved');
    click('Save loan renewal');
    await screen.findByText('No overdue books in this school.');
    click('Issue & returns');
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    change('Return outcome', 'damaged');
    change('Return / loss note', 'Cover needs repair');
    click('Save book return');
    await screen.findByText('Loan closed and copy availability updated.');
    click('Catalogue');
    await screen.findByText('0 available of 1 copies');
    change('Copy state', 'active');
    change('Copy state reason', 'Cover repaired and checked');
    click('Save copy state');
    await screen.findByText('1 available of 1 copies');
    click('Borrowing history');
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    change('Filter borrower', 'class-a-student-1');
    assert(screen.getByText('Cover needs repair'));
    await as('parent.a');
    click('Library');
    await screen.findByRole('heading', { name: 'UI reading book · UI-ACC-1' });
    assert(screen.getByText('damaged'));
    assert(screen.getByRole('heading', { name: 'Previous borrowing' }));
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('support staff screens connect reported issues, principal assignments, blocked escalation and verified closure', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maintenance-ui-')),
    db = openFileDatabase(path.join(directory, 'test.sqlite')),
    originalFetch = globalThis.fetch;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'OfficerUI-Test-1234');
    const handler = createHandler(db, origin);
    let cookie = '';
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
    const as = async (username: string) => {
      cleanup();
      const login = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'OfficerUI-Test-1234' }),
        }),
      );
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      const account = await one<Account>(
        db,
        'SELECT id,name,username,role FROM account WHERE username=?',
        username,
      );
      assert(account);
      render(
        <PortalPanel
          workspace={await workspace(db, account)}
          date={todayInNagpur()}
        />,
      );
      await screen.findByRole('navigation', {
        name: 'School community sections',
      });
      if (username === 'library.a')
        await screen.findByLabelText('Library school');
    };
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const click = (name: string) =>
      fireEvent.click(screen.getByRole('button', { name }));
    await as('teacher.a');
    click('Report facility issue');
    await screen.findByRole('heading', { name: 'School care overview' });
    click('My reported issues');
    change('Ticket title', 'UI washroom repair');
    change('Maintenance category', 'water');
    change('Issue location', 'Ground-floor washroom');
    change('Ticket urgency', 'high');
    change('Issue details', 'Water tap is leaking');
    click('Submit maintenance ticket');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    await as('principal.a');
    click('Facilities & maintenance');
    await screen.findByRole('heading', { name: 'School care overview' });
    click('All active work');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Assigned support staff', 'support.a');
    change(
      'Assignment instructions',
      'Replace tap valve and check water supply',
    );
    click('Save maintenance assignment');
    await screen.findByText('assigned', { selector: 'span.erp-status' });
    await as('support.a');
    await screen.findByRole('heading', { name: 'School care overview' });
    click('My maintenance work');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Work progress status', 'blocked');
    change('Work progress report', 'Replacement valve is required');
    click('Save maintenance progress');
    await screen.findByText('blocked', { selector: 'span.erp-status' });
    assert(
      !screen.queryByRole('button', { name: 'Save maintenance verification' }),
    );
    await as('principal.a');
    click('Facilities & maintenance');
    click('All active work');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Escalation reason', 'Request external repair assistance');
    click('Create education-office request');
    await screen.findByText(
      'Education-office request created. Follow it in Officer coordination.',
    );
    click('Open officer coordination');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    assert(screen.getByText('submitted', { selector: 'span.erp-status' }));
    await as('support.a');
    click('My maintenance work');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Work progress status', 'reported');
    change('Work progress report', 'Valve replaced and tested');
    click('Save maintenance progress');
    await screen.findByText('reported', { selector: 'span.erp-status' });
    await as('principal.a');
    const verifyQueue = await screen.findByRole('button', {
      name: /Maintenance completion reports/,
    });
    assert(verifyQueue.textContent?.includes('1'));
    fireEvent.click(verifyQueue);
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Completion decision', 'in-progress');
    change('Completion verification note', 'Check the adjacent tap too');
    click('Save maintenance verification');
    await screen.findByText(
      'No maintenance tickets match this section and filter.',
    );
    await as('support.a');
    click('My maintenance work');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Work progress status', 'reported');
    change('Work progress report', 'Both taps checked and functioning');
    click('Save maintenance progress');
    await screen.findByText('reported', { selector: 'span.erp-status' });
    await as('principal.a');
    click('Facilities & maintenance');
    click('Verify completion');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    change('Completion verification note', 'Verified both taps at school');
    click('Save maintenance verification');
    await waitFor(async () =>
      assert.equal(
        (
          await one<{ status: string }>(
            db,
            "SELECT status FROM maintenance_ticket WHERE title='UI washroom repair'",
          )
        )?.status,
        'closed',
      ),
    );
    await as('support.a');
    click('Work history');
    await screen.findByRole('heading', { name: 'UI washroom repair' });
    assert(screen.getByText('closed', { selector: 'span.erp-status' }));
    assert(screen.getByText('Both taps checked and functioning'));
    click('Inventory');
    await screen.findByRole('heading', { name: 'Inventory' });
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
