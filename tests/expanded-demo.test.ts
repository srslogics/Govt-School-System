import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeDatabase,
  openFileDatabase,
  one,
  many,
  run,
} from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { seedLearningDemo } from '../lib/erp/learning-demo';
import { seedTeacherDemo } from '../lib/erp/teacher-demo';
import { seedExpandedDemo, sampleDay } from '../lib/erp/expanded-demo';
import { createHandler } from '../lib/erp/http';
import type { LearningView } from '../lib/erp/learning';
import type { TeacherView } from '../lib/erp/teacher';
import type { OversightView } from '../lib/erp/oversight';
import type { LibraryView } from '../lib/erp/library';
import { todayInNagpur } from '../lib/erp/model';

const origin = 'http://127.0.0.1:3012';
const enabled = { ERP_EXPANDED_DEMO: 'true' };
const password = 'FictionalExpanded-1234';
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'expanded-demo-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  return {
    db,
    close: () => {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

void test('expanded fictional network has coherent records, protected scope and durable edits across restarts', async () => {
  const { db, close } = fixture();
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => password);
    await seedLearningDemo(db);
    await seedTeacherDemo(db);
    const today = todayInNagpur();
    const existingEntries = JSON.stringify(
      await many(
        db,
        "SELECT id,name,roll,'present' AS mark FROM enrolment WHERE class_id='class-a'",
      ),
    );
    await run(
      db,
      "INSERT INTO register VALUES ('existing-register','class-a',?,'submitted',1,?)",
      today,
      existingEntries,
    );
    await run(
      db,
      "INSERT INTO register_event VALUES ('existing-register',1,'teacher.a','Demo Teacher A','submitted',?,'Original teacher entry',0,?)",
      today + 'T04:30:00.000Z',
      existingEntries,
    );
    await run(
      db,
      "INSERT INTO school_operation VALUES ('existing-staff-attendance','school-a','staff-attendance',?,'present',?,'office.a',?,1)",
      `teacher.a:${today}`,
      JSON.stringify({
        staffId: 'teacher.a',
        staffName: 'Demo Teacher A',
        day: today,
        note: 'Original office entry',
      }),
      today + 'T04:30:00.000Z',
    );
    const credentials = await many(
      db,
      'SELECT id,password_hash FROM account ORDER BY id',
    );
    assert.equal(
      await seedExpandedDemo(db, origin, enabled, today),
      'expanded',
    );
    const count = async (table: string) =>
      (await one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`))!.n;
    assert.equal(await count('school'), 8);
    assert.equal(await count('class_section'), 16);
    assert.equal(await count('enrolment'), 522);
    assert.equal(await count('assessment'), 5226);
    assert.equal(await count('library_book'), 96);
    assert.equal(await count('library_copy'), 288);
    assert.equal(await count('library_loan'), 160);
    assert.equal(await count('maintenance_ticket'), 48);
    assert.equal(await count('education_record'), 96);
    assert.equal(await count('municipal_priority'), 32);
    assert.ok((await count('register')) > 200);
    assert.deepEqual((await db.execute('PRAGMA foreign_key_check')).rows, []);
    assert.deepEqual(
      await many(
        db,
        "SELECT id,password_hash FROM account WHERE id NOT LIKE 'ss49-sample-%' ORDER BY id",
      ),
      credentials,
    );
    for (const sql of [
      'SELECT e.id FROM enrolment e JOIN class_section c ON c.id=e.class_id WHERE e.effective_on<c.effective_on',
      "SELECT a.id FROM assessment a JOIN enrolment e ON e.id=a.student_id WHERE a.id LIKE 'ss49-sample-%' AND (a.day<e.effective_on OR a.day>?)",
      'SELECT l.id FROM library_loan l JOIN enrolment e ON e.id=l.student_id JOIN class_section c ON c.id=e.class_id WHERE l.school_id<>c.school_id OR l.issued_on<e.effective_on OR l.due_on<l.issued_on OR l.closed_on<l.issued_on',
      'SELECT r.id FROM register r JOIN class_section c ON c.id=r.class_id WHERE r.day<c.effective_on',
      'SELECT r.id FROM register r WHERE r.version<>(SELECT MAX(e.version) FROM register_event e WHERE e.register_id=r.id)',
      "SELECT l.id FROM library_loan l JOIN library_copy c ON c.id=l.copy_id WHERE l.closed_on IS NULL AND c.state<>'active'",
    ])
      assert.deepEqual(
        await many(db, sql, ...(sql.includes('?') ? [today] : [])),
        [],
        sql,
      );
    assert.equal(
      (await one<{ entries: string }>(
        db,
        "SELECT entries FROM register WHERE id='existing-register'",
      ))!.entries,
      existingEntries,
    );
    assert.equal(
      (await one<{ n: number }>(
        db,
        "SELECT COUNT(*) AS n FROM school_operation WHERE kind='staff-attendance' AND json_extract(data,'$.staffId')='teacher.a' AND json_extract(data,'$.day')=?",
        today,
      ))!.n,
      1,
    );
    const operations = await many<{ id: string; kind: string; data: string }>(
      db,
      'SELECT id,kind,data FROM school_operation',
    );
    for (const op of operations.filter((o) => o.kind === 'grant')) {
      const budget = JSON.parse(op.data).amount as number;
      const spent = operations
        .filter(
          (o) => o.kind === 'expense' && JSON.parse(o.data).grantId === op.id,
        )
        .reduce((sum, o) => sum + JSON.parse(o.data).amount, 0);
      assert.ok(spent > 0 && spent <= budget);
    }
    for (const op of operations.filter((o) => o.kind === 'inventory')) {
      const balance = operations
        .filter(
          (o) => o.kind === 'movement' && JSON.parse(o.data).itemId === op.id,
        )
        .reduce((sum, o) => {
          const d = JSON.parse(o.data);
          return sum + (d.direction === 'receive' ? 1 : -1) * d.quantity;
        }, JSON.parse(op.data).quantity);
      assert.ok(balance >= 0);
    }
    const handler = createHandler(db, origin);
    async function client(username: string) {
      const login = await handler(
        new Request(`${origin}/api/erp/login`, {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        }),
      );
      assert.equal(login.status, 200, username);
      const cookie = login.headers.get('set-cookie')!.split(';')[0];
      return async <T>(
        path: string,
        body?: Record<string, unknown>,
      ): Promise<T> => {
        const response = await handler(
          new Request(`${origin}/api/erp/${path}`, {
            method: body ? 'POST' : 'GET',
            headers: {
              cookie,
              ...(body ? { origin, 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        );
        assert.equal(
          response.status,
          200,
          `${username}: ${path} ${await response.clone().text()}`,
        );
        return (await response.json()) as T;
      };
    }
    const parent = await client('parent.a');
    const family = await parent<LearningView>(`learning?date=${today}`);
    assert.equal(family.learners.length, 2);
    const children = new Set(family.learners.map((s: { id: string }) => s.id));
    assert.ok(family.assessments.length >= 15);
    assert.ok(
      family.assessments.every((a) => children.has(a.studentId) && a.published),
    );
    assert.ok(
      (await parent<LibraryView>('library')).loans.every(
        (l: { studentId: string }) => children.has(l.studentId),
      ),
    );
    const teacher = await client('teacher.a');
    const classroom = await teacher<TeacherView>(`teacher?date=${today}`);
    assert.equal(classroom.learners.length, 35);
    assert.ok(classroom.homework.length >= 6);
    assert.equal(classroom.lessons.length, 15);
    const principal = await client('principal.a');
    const overview = await principal<OversightView>(`oversight?date=${today}`);
    assert.equal(overview.schools.length, 1);
    assert.equal(overview.schools[0].enrolled, 69);
    assert.ok(overview.schools[0].attendance.total > 0);
    const officer = await client('officer.a');
    assert.equal(
      (await officer<OversightView>(`oversight?date=${today}`)).schools.length,
      4,
    );
    const commissioner = await client('commissioner');
    assert.equal(
      (await commissioner<OversightView>(`oversight?date=${today}`)).schools
        .length,
      8,
    );
    for (const [username, path, field, min] of [
      ['office.a', 'operations', 'records', 7],
      ['accounts.a', 'operations', 'records', 15],
      ['library.a', 'library', 'books', 12],
      ['support.a', 'maintenance', 'tickets', 5],
      ['parent.b', `portal?date=${today}`, 'children', 2],
      ['teacher.b', `teacher?date=${today}`, 'learners', 37],
      ['principal.b', `oversight?date=${today}`, 'schools', 1],
      ['admin', 'setup', 'enrolments', 522],
    ] as const) {
      const call = await client(username);
      assert.ok(
        (await call<Record<string, unknown[]>>(path))[field].length >= min,
        `${username} ${field}`,
      );
    }
    // Seeded cases remain usable through the same approval/circulation APIs as entered records.
    await principal('operations', {
      action: 'decide',
      schoolId: 'school-a',
      id: 'ss49-sample-op-0-payroll-0',
      version: 1,
      status: 'approved',
      note: 'Salary statement checked for the walkthrough.',
    });
    await principal('maintenance', {
      action: 'verify',
      schoolId: 'school-a',
      id: 'ss49-sample-repair-0-4',
      version: 2,
      status: 'closed',
      note: 'Gate hinge inspected and closure verified.',
    });
    await officer('oversight', {
      action: 'review-request',
      schoolId: 'school-a',
      id: 'ss49-sample-education-request-0-0',
      version: 1,
      note: 'Verified the materials requirement against the class roster.',
    });
    const librarian = await client('library.a');
    await librarian('library', {
      action: 'return',
      schoolId: 'school-a',
      id: 'ss49-sample-book-0-0-copy-0-loan',
      version: 1,
      closedOn: today,
      outcome: 'returned',
      note: 'Book returned in good condition.',
    });
    assert.equal(
      (await one<{ status: string }>(
        db,
        "SELECT status FROM school_operation WHERE id='ss49-sample-op-0-payroll-0'",
      ))!.status,
      'approved',
    );
    assert.equal(
      (await one<{ status: string }>(
        db,
        "SELECT status FROM maintenance_ticket WHERE id='ss49-sample-repair-0-4'",
      ))!.status,
      'closed',
    );
    const totals = await Promise.all(
      [
        'enrolment',
        'school_operation',
        'register',
        'assessment',
        'library_loan',
      ].map(count),
    );
    const register = (await one<{ id: string; entries: string }>(
      db,
      'SELECT id,entries FROM register WHERE class_id=? AND day=?',
      'class-a',
      today,
    ))!;
    const edited = JSON.parse(register.entries);
    edited[0].mark = 'leave';
    await run(
      db,
      'UPDATE register SET entries=? WHERE id=?',
      JSON.stringify(edited),
      register.id,
    );
    await run(
      db,
      "UPDATE staff_task SET note='Manual review kept' WHERE id='ss49-sample-task-0-0-0'",
    );
    assert.equal(
      await seedExpandedDemo(db, origin, enabled, today),
      'already expanded',
    );
    assert.deepEqual(
      await Promise.all(
        [
          'enrolment',
          'school_operation',
          'register',
          'assessment',
          'library_loan',
        ].map(count),
      ),
      totals,
    );
    assert.equal(
      (await one<{ entries: string }>(
        db,
        'SELECT entries FROM register WHERE id=?',
        register.id,
      ))!.entries,
      JSON.stringify(edited),
    );
    assert.equal(
      (await one<{ note: string }>(
        db,
        "SELECT note FROM staff_task WHERE id='ss49-sample-task-0-0-0'",
      ))!.note,
      'Manual review kept',
    );
    // A later startup adds the walkthrough date without rewriting previous days.
    const tomorrow = sampleDay(today, 1);
    await seedExpandedDemo(db, origin, enabled, tomorrow);
    assert.equal(
      (await one<{ n: number }>(
        db,
        'SELECT COUNT(*) AS n FROM register WHERE day=?',
        tomorrow,
      ))!.n,
      16,
    );
    assert.equal(
      (await one<{ entries: string }>(
        db,
        'SELECT entries FROM register WHERE id=?',
        register.id,
      ))!.entries,
      JSON.stringify(edited),
    );
  } finally {
    close();
  }
});

void test('sample expansion requires an opted-in loopback or exact hosted fixture and rolls back conflicts', async () => {
  const { db, close } = fixture();
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => password);
    assert.equal(await seedExpandedDemo(db, origin, {}), 'not enabled');
    assert.equal(
      await seedExpandedDemo(db, 'https://production.example', enabled),
      'not enabled',
    );
    assert.equal(
      await seedExpandedDemo(db, 'https://govt-school-system.onrender.com', {}),
      'not enabled',
    );
    await run(
      db,
      "UPDATE enrolment SET name='Custom learner' WHERE id='class-a-student-1'",
    );
    assert.equal(
      await seedExpandedDemo(db, origin, enabled),
      'not sample fixture',
    );
    await run(
      db,
      "UPDATE enrolment SET name='Sample learner A-1' WHERE id='class-a-student-1'",
    );
    await run(
      db,
      "INSERT INTO school_operation VALUES ('ss49-sample-op-0-staff-0','school-a','staff-attendance','custom','present','{}','office.a','2026-01-01T00:00:00Z',1)",
    );
    await assert.rejects(seedExpandedDemo(db, origin, enabled));
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM school'))!.n,
      2,
    );
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM enrolment'))!.n,
      10,
    );
    assert.equal(
      await one(
        db,
        "SELECT id FROM school_activity WHERE id='ss49-expanded-sample-v1'",
      ),
      undefined,
    );
  } finally {
    close();
  }
});

void test('hosted sample preparation uses bounded uploads and one atomic commit, rejecting concurrent edits', async () => {
  const { db, close } = fixture();
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => password);
    let batches = 0;
    let race = true;
    const hosted = new Proxy(db, {
      get(target, property, receiver) {
        if (property === 'transaction')
          return () => {
            throw new Error(
              'Interactive transactions are forbidden during sample preparation',
            );
          };
        if (property === 'execute') return target.execute.bind(target);
        if (property === 'batch')
          return async (
            statements: Parameters<typeof db.batch>[0],
            mode: Parameters<typeof db.batch>[1],
          ) => {
            const committing = statements.some(
              (statement) =>
                typeof statement !== 'string' &&
                !Array.isArray(statement) &&
                statement.sql.includes(
                  'sample fixture changed during preparation',
                ),
            );
            if (committing) batches++;
            assert.equal(mode, 'write');
            assert.ok(
              Array.isArray(statements) && statements.length < 50,
              'compact dependency-ordered bulk inserts',
            );
            assert.ok(
              Buffer.byteLength(JSON.stringify(statements)) < 256 * 1024,
              'bounded hosted request payload',
            );
            if (race && committing)
              await run(
                db,
                "UPDATE enrolment SET name='Edited during preparation' WHERE id='class-a-student-1'",
              );
            return target.batch(statements, mode);
          };
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    await assert.rejects(seedExpandedDemo(hosted, origin, enabled));
    assert.equal(batches, 1);
    assert.equal(
      (await one<{ n: number }>(
        db,
        'SELECT COUNT(*) AS n FROM erp_sample_import',
      ))!.n,
      0,
    );
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM school'))!.n,
      2,
    );
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM account'))!.n,
      13,
    );
    assert.equal(
      (await one<{ name: string }>(
        db,
        "SELECT name FROM enrolment WHERE id='class-a-student-1'",
      ))!.name,
      'Edited during preparation',
    );
    await run(
      db,
      "UPDATE enrolment SET name='Sample learner A-1' WHERE id='class-a-student-1'",
    );
    race = false;
    assert.equal(await seedExpandedDemo(hosted, origin, enabled), 'expanded');
    assert.equal(batches, 2);
    assert.equal(
      (await one<{ n: number }>(
        db,
        'SELECT COUNT(*) AS n FROM erp_sample_import',
      ))!.n,
      0,
    );
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM enrolment'))!.n,
      522,
    );
  } finally {
    close();
  }
});

void test('sample retry API requires administrator and same-origin access, redacts transport errors and permits a safe retry', async () => {
  const { db, close } = fixture();
  const oldEnabled = process.env.ERP_EXPANDED_DEMO,
    oldToken = process.env.TURSO_AUTH_TOKEN;
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => password);
    process.env.ERP_EXPANDED_DEMO = 'true';
    process.env.TURSO_AUTH_TOKEN = 'fictional-secret-redaction-check';
    let fail = true;
    const transport = new Proxy(db, {
      get(target, property, receiver) {
        if (property === 'execute') return target.execute.bind(target);
        if (property === 'transaction')
          return (mode: 'write' | 'read' | 'deferred' = 'write') =>
            target.transaction(mode);
        if (property === 'batch')
          return async (
            statements: Parameters<typeof db.batch>[0],
            mode: Parameters<typeof db.batch>[1],
          ) => {
            if (
              fail &&
              statements.some(
                (s) =>
                  typeof s !== 'string' &&
                  !Array.isArray(s) &&
                  s.sql.startsWith('INSERT INTO erp_sample_import'),
              )
            )
              throw new TypeError('fetch failed', {
                cause: new Error(
                  'Upload rejected: fictional-secret-redaction-check https://database.example/private',
                ),
              });
            return target.batch(statements, mode);
          };
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const handler = createHandler(transport, origin);
    const call = (
      cookie: string,
      body: Record<string, unknown>,
      requestOrigin = origin,
    ) =>
      handler(
        new Request(origin + '/api/erp/sample-data', {
          method: 'POST',
          headers: {
            cookie,
            origin: requestOrigin,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      );
    const login = async (username: string) => {
      const res = await handler(
        new Request(origin + '/api/erp/login', {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        }),
      );
      assert.equal(res.status, 200);
      return res.headers.get('set-cookie')!.split(';')[0];
    };
    assert.equal((await call('', { action: 'expand' })).status, 401);
    const parent = await login('parent.a');
    assert.equal((await call(parent, { action: 'expand' })).status, 403);
    const admin = await login('admin');
    const statusBefore = await handler(
      new Request(origin + '/api/erp/sample-data', {
        headers: { cookie: admin },
      }),
    );
    assert.equal(statusBefore.status, 200);
    const before = (await statusBefore.json()) as {
      schools: number;
      learners: number;
      expanded: number;
    };
    assert.equal(before.schools, 2);
    assert.equal(before.learners, 10);
    assert.equal(before.expanded, 0);
    assert.equal(
      (
        await handler(
          new Request(origin + '/api/erp/sample-data', {
            headers: { cookie: parent },
          }),
        )
      ).status,
      403,
    );

    assert.equal(
      (await call(admin, { action: 'expand' }, 'https://unrelated.example'))
        .status,
      403,
    );
    assert.equal((await call(admin, { action: 'reset' })).status, 400);
    const failure = await call(admin, { action: 'expand' });
    assert.equal(failure.status, 500);
    const details = await failure.text();
    assert.match(details, /fetch failed/);
    assert.match(details, /redacted/);
    assert.ok(!details.includes('fictional-secret-redaction-check'));
    assert.ok(!details.includes('database.example'));
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM school'))!.n,
      2,
    );
    assert.equal(
      (await one<{ n: number }>(
        db,
        'SELECT COUNT(*) AS n FROM erp_sample_import',
      ))!.n,
      0,
    );
    fail = false;
    assert.equal((await call(admin, { action: 'expand' })).status, 200);
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM enrolment'))!.n,
      522,
    );
    const rerun = await call(admin, { action: 'expand' });
    assert.equal(rerun.status, 200);
    assert.deepEqual(await rerun.json(), { result: 'already expanded' });
  } finally {
    if (oldEnabled === undefined) delete process.env.ERP_EXPANDED_DEMO;
    else process.env.ERP_EXPANDED_DEMO = oldEnabled;
    if (oldToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = oldToken;
    close();
  }
});

void test('sample import retries safe dropped connections, tolerates lost upload acknowledgements and never repeats an ambiguous final commit', async () => {
  const { db, close } = fixture();
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => password);
    let readDrops = 2,
      uploadAckLost = false,
      commitAttempts = 0;
    const disconnected = () =>
      new TypeError('fetch failed', { cause: new Error('other side closed') });
    const flaky = new Proxy(db, {
      get(target, property, receiver) {
        if (property === 'execute')
          return async (
            statement: Parameters<typeof db.execute>[0],
            args?: Parameters<typeof db.execute>[1],
          ) => {
            if (readDrops-- > 0) throw disconnected();
            return typeof statement === 'string'
              ? target.execute(statement, args)
              : target.execute(statement);
          };
        if (property === 'batch')
          return async (
            statements: Parameters<typeof db.batch>[0],
            mode: Parameters<typeof db.batch>[1],
          ) => {
            const sql = statements.map((s) =>
              typeof s === 'string' ? s : Array.isArray(s) ? s[0] : s.sql,
            );
            const committing = sql.some((s) =>
              s.includes('sample fixture changed during preparation'),
            );
            if (committing) commitAttempts++;
            const result = await target.batch(statements, mode);
            if (
              !uploadAckLost &&
              sql.some((s) => s.startsWith('INSERT INTO erp_sample_import'))
            ) {
              uploadAckLost = true;
              throw disconnected();
            }
            if (committing && commitAttempts === 1) throw disconnected();
            return result;
          };
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    await assert.rejects(
      seedExpandedDemo(flaky, origin, enabled),
      /Sample final commit: fetch failed/,
    );
    assert.ok(uploadAckLost);
    assert.equal(commitAttempts, 1);
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM enrolment'))!.n,
      522,
    );
    assert.equal(
      (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM assessment'))!.n,
      5220,
    );
    assert.equal(
      (await one<{ n: number }>(
        db,
        'SELECT COUNT(*) AS n FROM erp_sample_import',
      ))!.n,
      0,
    );
    assert.equal(
      await seedExpandedDemo(flaky, origin, enabled),
      'already expanded',
    );
    assert.equal(commitAttempts, 1);
  } finally {
    close();
  }
});
