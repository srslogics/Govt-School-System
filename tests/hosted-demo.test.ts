import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  openFileDatabase,
  initializeDatabase,
  many,
  one,
  run,
  write,
  type Database,
} from '../lib/erp/database';
import { fictionalAccounts, seedFictionalSchools } from '../lib/erp/seed';
import {
  prepareHostedMeetingDemo,
  meetingDemoPassword,
} from '../lib/erp/hosted-demo';
import { createHandler } from '../lib/erp/http';
import { passwordHash } from '../lib/erp/auth';
import { todayInNagpur, type Account } from '../lib/erp/model';
import { updateRegister, getRegister } from '../lib/erp/attendance';

const origin = 'https://govt-school-system.onrender.com';
const hosted = { RENDER: 'true', RENDER_EXTERNAL_URL: origin };
const originalPassword = 'OriginalDemoPassword-5271';
async function fixture(action: (db: Database) => Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), 'hosted-demo-signin-'));
  const db = openFileDatabase(join(directory, 'fixture.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => originalPassword);
    await action(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
async function legacyAccounts(db: Database) {
  await write(db, async (tx) => {
    await run(tx, 'DELETE FROM staff_task');
    await run(tx, 'DELETE FROM guardian_link');
    await run(
      tx,
      "DELETE FROM school_assignment WHERE account_id IN (SELECT id FROM account WHERE role IN ('parent','clerk','accountant','librarian','support'))",
    );
    await run(
      tx,
      "DELETE FROM account WHERE role IN ('parent','clerk','accountant','librarian','support')",
    );
  });
}
void test('hosted demo setup adds missing accounts, verifies the shared password for every role, and preserves attendance', () =>
  fixture(async (db) => {
    await legacyAccounts(db);
    const teacher = await one<Account>(
      db,
      "SELECT id, username, name, role FROM account WHERE id='teacher.a'",
    );
    assert(teacher);
    const day = todayInNagpur();
    const roster = await getRegister(db, teacher, 'class-a', day);
    await updateRegister(db, teacher, 'class-a', day, {
      action: 'submit',
      version: 0,
      marks: Object.fromEntries(
        roster.roster.map((student) => [student.id, 'present']),
      ),
    });
    const originalHistory = await many(db, 'SELECT * FROM register_event');
    const originalAssignments = await many(
      db,
      'SELECT * FROM class_assignment ORDER BY account_id',
    );
    assert.equal(await prepareHostedMeetingDemo(db, origin, hosted), 'applied');
    assert.equal((await many(db, 'SELECT id FROM account')).length, 13);
    assert.deepEqual(
      await many(db, 'SELECT * FROM register_event'),
      originalHistory,
    );
    assert.deepEqual(
      await many(db, 'SELECT * FROM class_assignment ORDER BY account_id'),
      originalAssignments,
    );
    assert.equal((await many(db, 'SELECT * FROM guardian_link')).length, 2);
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
    const handler = createHandler(db, origin);
    for (const [username] of fictionalAccounts) {
      const response = await handler(
        new Request(`${origin}/api/erp/login`, {
          method: 'POST',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: meetingDemoPassword }),
        }),
      );
      assert.equal(response.status, 200, username);
    }
  }));
void test('hosted demo setup is one-time and does not regrant revoked parent access or reset passwords on restart', () =>
  fixture(async (db) => {
    await run(db, "DELETE FROM guardian_link WHERE account_id='parent.a'");
    await run(db, "DELETE FROM school_assignment WHERE account_id='library.a'");
    assert.equal(await prepareHostedMeetingDemo(db, origin, hosted), 'applied');
    assert.equal(
      (
        await many(
          db,
          "SELECT * FROM guardian_link WHERE account_id='parent.a'",
        )
      ).length,
      0,
    );
    assert.equal(
      (
        await many(
          db,
          "SELECT * FROM school_assignment WHERE account_id='library.a'",
        )
      ).length,
      0,
    );
    const changed = passwordHash('ChangedAfterMeeting-5271');
    await run(
      db,
      "UPDATE account SET password_hash=? WHERE id='teacher.a'",
      changed,
    );
    assert.equal(
      await prepareHostedMeetingDemo(db, origin, hosted),
      'already applied',
    );
    assert.equal(
      (
        await one<{ password_hash: string }>(
          db,
          "SELECT password_hash FROM account WHERE id='teacher.a'",
        )
      )?.password_hash,
      changed,
    );
  }));
void test('other deployments and non-fixture accounts never receive the shared meeting password', () =>
  fixture(async (db) => {
    const before = await many(db, 'SELECT * FROM account ORDER BY id');
    for (const [url, env] of [
      ['http://127.0.0.1:3011', hosted],
      [origin, {}],
      [
        origin,
        {
          ...hosted,
          RENDER_EXTERNAL_URL: 'https://another-school.onrender.com',
        },
      ],
    ] as const)
      assert.equal(
        await prepareHostedMeetingDemo(db, url, env),
        'not this host',
      );
    assert.deepEqual(
      await many(db, 'SELECT * FROM account ORDER BY id'),
      before,
    );
    await run(
      db,
      "INSERT INTO account VALUES ('custom','custom.staff','Custom Staff','teacher',?)",
      passwordHash(originalPassword),
    );
    const withCustom = await many(db, 'SELECT * FROM account ORDER BY id');
    assert.equal(
      await prepareHostedMeetingDemo(db, origin, hosted),
      'not a fixture database',
    );
    assert.deepEqual(
      await many(db, 'SELECT * FROM account ORDER BY id'),
      withCustom,
    );
  }));
void test('failed account setup rolls back all password and account changes', () =>
  fixture(async (db) => {
    await legacyAccounts(db);
    const before = await many(db, 'SELECT * FROM account ORDER BY id');
    await run(
      db,
      "CREATE TRIGGER reject_demo BEFORE INSERT ON account WHEN NEW.id='support.a' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    await assert.rejects(prepareHostedMeetingDemo(db, origin, hosted));
    assert.deepEqual(
      await many(db, 'SELECT * FROM account ORDER BY id'),
      before,
    );
    assert.equal((await many(db, 'SELECT * FROM guardian_link')).length, 0);
  }));
