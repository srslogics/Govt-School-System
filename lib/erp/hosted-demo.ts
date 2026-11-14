import { randomBytes, scryptSync } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import { many, one, run, write, type Database } from './database';
import { fictionalAccounts } from './seed';
import type { Account, School } from './model';

const meetingOrigin = 'https://govt-school-system.onrender.com';
const setupId = 'meeting-demo-signin-v1';
export const meetingDemoPassword = 'Demo@2026';

// Explicitly requested public meeting credentials, restricted to this fictional
// demonstration deployment. Normal account creation retains its password policy.
export async function prepareHostedMeetingDemo(
  db: Database,
  origin: string,
  env: Record<string, string | undefined> = process.env,
): Promise<
  'applied' | 'already applied' | 'not this host' | 'not a fixture database'
> {
  if (
    origin !== meetingOrigin ||
    env.RENDER !== 'true' ||
    env.RENDER_EXTERNAL_URL?.replace(/\/$/, '') !== meetingOrigin
  )
    return 'not this host';
  return write(db, async (tx) => {
    const setupTable = await one(
      tx,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='meeting_demo_setup'",
    );
    if (
      setupTable &&
      (await one(tx, 'SELECT id FROM meeting_demo_setup WHERE id=?', setupId))
    )
      return 'already applied';
    const schools = await many<School>(tx, 'SELECT id, code, name FROM school');
    const accounts = await many<Account>(
      tx,
      'SELECT id, username, name, role FROM account',
    );
    const fixture = new Map(
      fictionalAccounts.map(([username, name, role]) => [
        username,
        { name, role },
      ]),
    );
    if (
      schools.length !== 2 ||
      !schools.some(
        (school) =>
          school.id === 'school-a' &&
          school.code === 'DEMO-A' &&
          school.name === 'NMC Demo School A · Fictional',
      ) ||
      !schools.some(
        (school) =>
          school.id === 'school-b' &&
          school.code === 'DEMO-B' &&
          school.name === 'NMC Demo School B · Fictional',
      ) ||
      !accounts.length ||
      accounts.some(
        (account) =>
          account.id !== account.username ||
          fixture.get(account.username)?.name !== account.name ||
          fixture.get(account.username)?.role !== account.role,
      )
    )
      return 'not a fixture database';
    // Verify the sample relationships before making any credential changes.
    for (const [student, school] of [
      ['class-a-student-1', 'school-a'],
      ['class-b-student-1', 'school-b'],
    ]) {
      if (
        !(await one(
          tx,
          'SELECT e.id FROM enrolment e JOIN class_section c ON c.id=e.class_id WHERE e.id=? AND c.school_id=?',
          student,
          school,
        ))
      )
        return 'not a fixture database';
    }
    await run(
      tx,
      'CREATE TABLE IF NOT EXISTS meeting_demo_setup (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    const statements: InStatement[] = [];
    for (const [username, name, role] of fictionalAccounts) {
      const exists = accounts.some((account) => account.username === username);
      const salt = randomBytes(16).toString('hex');
      const hash =
        salt + ':' + scryptSync(meetingDemoPassword, salt, 64).toString('hex');
      if (exists)
        statements.push({
          sql: 'UPDATE account SET password_hash=? WHERE id=?',
          args: [hash, username],
        });
      else {
        statements.push({
          sql: 'INSERT INTO account VALUES (?, ?, ?, ?, ?)',
          args: [username, username, name, role, hash],
        });
        if (role === 'parent')
          statements.push({
            sql: 'INSERT INTO guardian_link VALUES (?, ?)',
            args: [
              username,
              username === 'parent.a'
                ? 'class-a-student-1'
                : 'class-b-student-1',
            ],
          });
        if (['clerk', 'accountant', 'librarian', 'support'].includes(role))
          statements.push({
            sql: 'INSERT INTO school_assignment VALUES (?, ?)',
            args: [username, 'school-a'],
          });
      }
      statements.push({
        sql: 'DELETE FROM session WHERE account_id=?',
        args: [username],
      });
      statements.push({
        sql: 'DELETE FROM login_limit WHERE key=?',
        args: [`user:${username}`],
      });
    }
    statements.push({
      sql: "DELETE FROM login_limit WHERE key='global'",
      args: [],
    });
    statements.push({
      sql: 'INSERT INTO meeting_demo_setup VALUES (?, ?)',
      args: [setupId, new Date().toISOString()],
    });
    await tx.batch(statements);
    return 'applied';
  });
}
