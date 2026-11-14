import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeDatabase, openFileDatabase, one } from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { createHandler } from '../lib/erp/http';
import {
  todayInNagpur,
  type RegisterView,
  type SchoolPortal,
  type Setup,
} from '../lib/erp/model';

const password = 'FictionalParentTest-5271';
const origin = 'http://127.0.0.1:3020';
const date = todayInNagpur();

void test('parent attendance, school requests, staff tasks and notices enforce child, school and department scope', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'school-portals-'));
  const db = openFileDatabase(join(directory, 'pilot.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => password);
    const handler = createHandler(db, origin);
    const client = () => {
      let cookie = '';
      return {
        async call(path: string, body?: Record<string, unknown>) {
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
          if (response.headers.has('set-cookie'))
            cookie = response.headers.get('set-cookie')!.split(';')[0];
          return response;
        },
      };
    };
    const [
      parent,
      otherParent,
      principal,
      otherPrincipal,
      teacher,
      clerk,
      accountant,
      librarian,
      support,
      admin,
    ] = Array.from({ length: 10 }, client);
    for (const [who, username] of [
      [parent, 'parent.a'],
      [otherParent, 'parent.b'],
      [principal, 'principal.a'],
      [otherPrincipal, 'principal.b'],
      [teacher, 'teacher.a'],
      [clerk, 'office.a'],
      [accountant, 'accounts.a'],
      [librarian, 'library.a'],
      [support, 'support.a'],
      [admin, 'admin'],
    ] as const)
      assert.equal(
        (await who.call('login', { username, password })).status,
        200,
      );
    const portal = async (who: ReturnType<typeof client>) => {
      const response = await who.call(`portal?date=${date}`);
      assert.equal(response.status, 200);
      return (await response.json()) as SchoolPortal;
    };
    let family = await portal(parent);
    assert.deepEqual(
      family.children.map((child) => child.id),
      ['class-a-student-1'],
    );
    assert.equal(family.children[0].mark, null);
    assert.deepEqual(family.directory, []);
    assert.deepEqual(family.staff, []);
    assert.equal((await parent.call(`register/class-a/${date}`)).status, 404);
    assert.equal((await parent.call(`report?date=${date}`)).status, 403);
    assert.equal((await parent.call('setup')).status, 403);
    const register = (await (
      await teacher.call(`register/class-a/${date}`)
    ).json()) as RegisterView;
    assert.equal(
      (
        await teacher.call(`register/class-a/${date}`, {
          action: 'submit',
          version: 0,
          marks: Object.fromEntries(
            register.roster.map((student: { id: string }, index: number) => [
              student.id,
              index ? 'absent' : 'present',
            ]),
          ),
        })
      ).status,
      200,
    );
    family = await portal(parent);
    assert.equal(family.children[0].mark, 'present');
    assert(!JSON.stringify(family).includes('Sample learner A-2'));
    assert.equal(
      (
        await principal.call(`register/class-a/${date}`, {
          action: 'return',
          version: 1,
          note: 'Please check the register.',
        })
      ).status,
      200,
    );
    family = await portal(parent);
    assert.equal(family.children[0].mark, null);
    assert.equal(family.children[0].status, 'returned');

    const request = {
      action: 'request',
      schoolId: 'school-a',
      studentId: 'class-a-student-1',
      category: 'finance',
      title: 'Sample grant enquiry',
      body: 'Please explain the fictional entitlement.',
    };
    assert.equal(
      (
        await parent.call('portal', {
          ...request,
          studentId: 'class-a-student-2',
        })
      ).status,
      404,
    );
    assert.equal(
      (await parent.call('portal', { ...request, schoolId: 'school-b' }))
        .status,
      404,
    );
    assert.equal((await parent.call('portal', request)).status, 200);
    const finance = (await portal(parent)).requests[0];
    assert.equal((await portal(otherParent)).requests.length, 0);
    assert.equal((await portal(otherPrincipal)).requests.length, 0);
    assert.equal((await portal(librarian)).requests.length, 0);
    assert.equal((await portal(accountant)).requests[0].id, finance.id);
    const respond = {
      action: 'respond',
      id: finance.id,
      schoolId: 'school-a',
      version: 1,
      status: 'resolved',
      response: 'The school office will provide the checklist.',
    };
    assert.equal((await parent.call('portal', respond)).status, 403);
    assert.equal((await librarian.call('portal', respond)).status, 403);
    assert.equal((await otherPrincipal.call('portal', respond)).status, 404);
    assert.equal((await accountant.call('portal', respond)).status, 200);
    assert.equal((await accountant.call('portal', respond)).status, 409);
    assert.equal((await portal(parent)).requests[0].response, respond.response);

    const notice = {
      action: 'notice',
      schoolId: 'school-a',
      audience: 'staff',
      title: 'Staff-only planning',
      body: 'Review the sample work list.',
    };
    assert.equal((await teacher.call('portal', notice)).status, 403);
    assert.equal((await parent.call('portal', notice)).status, 403);
    assert.equal((await principal.call('portal', notice)).status, 200);
    assert(
      !(await portal(parent)).notices.some((row) => row.title === notice.title),
    );
    assert(
      (await portal(clerk)).notices.some((row) => row.title === notice.title),
    );
    assert.equal(
      (
        await principal.call('portal', {
          ...notice,
          audience: 'parents',
          title: 'Parents-only meeting',
        })
      ).status,
      200,
    );
    assert(
      (await portal(parent)).notices.some(
        (row) => row.title === 'Parents-only meeting',
      ),
    );
    assert(
      !(await portal(support)).notices.some(
        (row) => row.title === 'Parents-only meeting',
      ),
    );
    assert.equal((await portal(otherParent)).notices.length, 0);

    const libraryTask = (await portal(librarian)).tasks[0];
    const complete = {
      action: 'complete',
      id: libraryTask.id,
      schoolId: 'school-a',
      version: libraryTask.version,
      note: 'Reading materials checked.',
    };
    assert.equal((await accountant.call('portal', complete)).status, 404);
    assert.equal((await librarian.call('portal', complete)).status, 200);
    assert.equal((await librarian.call('portal', complete)).status, 409);
    assert.equal((await portal(librarian)).tasks[0].note, complete.note);
    assert.equal(
      (await portal(principal)).tasks.find((row) => row.id === libraryTask.id)
        ?.status,
      'completed',
    );
    const task = {
      action: 'task',
      schoolId: 'school-a',
      assignedTo: 'support.a',
      title: 'Check water station',
      body: 'Record whether a maintenance request is needed.',
    };
    assert.equal((await parent.call('portal', task)).status, 403);
    assert.equal(
      (await principal.call('portal', { ...task, assignedTo: 'teacher.b' }))
        .status,
      404,
    );
    assert.equal((await principal.call('portal', task)).status, 200);
    assert(
      (await portal(support)).tasks.some((row) => row.title === task.title),
    );
    assert.equal((await portal(clerk)).directory.length, 5);
    assert.equal((await portal(accountant)).directory.length, 0);
    assert.equal((await portal(librarian)).directory.length, 0);

    assert.equal(
      (
        await admin.call('setup', {
          action: 'unassign',
          accountId: 'library.a',
          targetId: 'school-a',
        })
      ).status,
      200,
    );
    assert.equal((await portal(librarian)).tasks.length, 0);
    assert.equal(
      (await librarian.call('portal', { ...complete, version: 2 })).status,
      404,
    );
    assert.equal(
      (
        await admin.call('setup', {
          action: 'unguardian',
          accountId: 'parent.a',
          studentId: 'class-a-student-1',
        })
      ).status,
      200,
    );
    assert.equal((await portal(parent)).children.length, 0);
    assert.equal((await parent.call('portal', request)).status, 404);
    assert.equal(
      (
        await admin.call('setup', {
          action: 'guardian',
          accountId: 'parent.a',
          studentId: 'class-a-student-2',
        })
      ).status,
      200,
    );
    assert.deepEqual(
      (await portal(parent)).children.map((child) => child.id),
      ['class-a-student-2'],
    );
    const config = (await (await admin.call('setup')).json()) as Setup;
    assert(
      config.guardians.some(
        (link) =>
          link.accountId === 'parent.a' &&
          link.studentId === 'class-a-student-2',
      ),
    );
    assert(
      await one(
        db,
        'SELECT id FROM school_activity WHERE action=?',
        'complete',
      ),
    );
    await initializeDatabase(db);
    assert.equal((await portal(parent)).children.length, 1);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('role migration preserves existing account credentials and referencing sessions without disabling foreign keys', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'school-migration-'));
  const db = openFileDatabase(join(directory, 'old.sqlite'));
  try {
    await db.execute('PRAGMA foreign_keys=ON');
    await db.batch(
      [
        "CREATE TABLE account(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('administrator','teacher','principal','officer','commissioner')), password_hash TEXT NOT NULL)",
        'CREATE TABLE session(token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES account(id), expires_at INTEGER NOT NULL)',
        "INSERT INTO account VALUES ('old-teacher','old.teacher','Existing Teacher','teacher','original-hash')",
        "INSERT INTO session VALUES ('existing-token','old-teacher',9999999999999)",
      ],
      'write',
    );
    await initializeDatabase(db);
    assert.equal(
      (
        await one<{ password_hash: string }>(
          db,
          "SELECT password_hash FROM account WHERE id='old-teacher'",
        )
      )?.password_hash,
      'original-hash',
    );
    assert(
      await one(db, "SELECT * FROM session WHERE token_hash='existing-token'"),
    );
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
    await db.execute(
      "INSERT INTO account VALUES ('new-parent','new.parent','New Parent','parent','test-hash')",
    );
    await initializeDatabase(db);
    assert(await one(db, "SELECT * FROM account WHERE id='new-parent'"));
    await assert.rejects(
      db.execute(
        "INSERT INTO account VALUES ('invalid','invalid.role','Invalid','invented','hash')",
      ),
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
