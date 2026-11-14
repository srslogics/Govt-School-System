import {
  createClient,
  type Client,
  type InValue,
  type Transaction,
} from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Database = Client;
export type Query = Pick<Client, 'execute'>;

const schema = `
CREATE TABLE IF NOT EXISTS school (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS class_section (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES school(id),
      grade TEXT NOT NULL COLLATE NOCASE, section TEXT NOT NULL COLLATE NOCASE,
      effective_on TEXT NOT NULL, UNIQUE(school_id, grade, section)
    );
    CREATE TABLE IF NOT EXISTS enrolment (
      id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES class_section(id),
      name TEXT NOT NULL, roll TEXT NOT NULL COLLATE NOCASE, effective_on TEXT NOT NULL,
      UNIQUE(class_id, roll)
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('administrator','teacher','principal','officer','commissioner','parent','clerk','accountant','librarian','support')),
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS school_assignment (
      account_id TEXT NOT NULL REFERENCES account(id), school_id TEXT NOT NULL REFERENCES school(id),
      PRIMARY KEY(account_id, school_id)
    );
    CREATE TABLE IF NOT EXISTS class_assignment (
      account_id TEXT NOT NULL REFERENCES account(id), class_id TEXT NOT NULL REFERENCES class_section(id),
      PRIMARY KEY(account_id, class_id)
    );
    CREATE TABLE IF NOT EXISTS session (
      token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES account(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_limit (
      key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS register (
      id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES class_section(id), day TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('submitted','reviewed','returned')),
      version INTEGER NOT NULL CHECK(version > 0),
      entries TEXT NOT NULL CHECK(json_valid(entries)), UNIQUE(class_id, day)
    );
    CREATE TABLE IF NOT EXISTS register_event (
      register_id TEXT NOT NULL REFERENCES register(id), version INTEGER NOT NULL,
      actor_id TEXT NOT NULL REFERENCES account(id), actor_name TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('submitted','reviewed','returned','resubmitted')),
      happened_at TEXT NOT NULL, note TEXT NOT NULL, changed_marks INTEGER NOT NULL,
      entries TEXT NOT NULL CHECK(json_valid(entries)), PRIMARY KEY(register_id, version)
    );
    CREATE TABLE IF NOT EXISTS teaching_period (
      id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES account(id), class_id TEXT NOT NULL REFERENCES class_section(id),
      weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7), start TEXT NOT NULL, end TEXT NOT NULL,
      subject TEXT NOT NULL, room TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0)
    );
    CREATE INDEX IF NOT EXISTS period_teacher ON teaching_period(teacher_id,weekday);
    CREATE TABLE IF NOT EXISTS assessment (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES enrolment(id), subject TEXT NOT NULL,
      exam TEXT NOT NULL, day TEXT NOT NULL, score REAL NOT NULL CHECK(score>=0),
      maximum REAL NOT NULL CHECK(maximum>0 AND score<=maximum), feedback TEXT NOT NULL,
      published INTEGER NOT NULL CHECK(published IN (0,1)), author_id TEXT NOT NULL REFERENCES account(id), version INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assessment_student ON assessment(student_id,day);
    CREATE TABLE IF NOT EXISTS homework (
      id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES class_section(id), subject TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, due TEXT NOT NULL, happened_at TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES account(id), version INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS homework_class ON homework(class_id,due);
    CREATE TABLE IF NOT EXISTS homework_submission (
      homework_id TEXT NOT NULL REFERENCES homework(id), student_id TEXT NOT NULL REFERENCES enrolment(id),
      note TEXT NOT NULL, feedback TEXT NOT NULL, happened_at TEXT NOT NULL, version INTEGER NOT NULL,
      PRIMARY KEY(homework_id,student_id)
    );
    CREATE TABLE IF NOT EXISTS guardian_link (
      account_id TEXT NOT NULL REFERENCES account(id), enrolment_id TEXT NOT NULL REFERENCES enrolment(id),
      PRIMARY KEY(account_id, enrolment_id)
    );
    CREATE TABLE IF NOT EXISTS school_notice (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES school(id), title TEXT NOT NULL, body TEXT NOT NULL,
      audience TEXT NOT NULL CHECK(audience IN ('all','parents','staff')), author_id TEXT NOT NULL REFERENCES account(id), happened_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS school_request (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES school(id), account_id TEXT NOT NULL REFERENCES account(id),
      enrolment_id TEXT REFERENCES enrolment(id), category TEXT NOT NULL CHECK(category IN ('leave','general','finance','library','maintenance')),
      title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','resolved','declined')),
      response TEXT NOT NULL, happened_at TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0)
    );
    CREATE TABLE IF NOT EXISTS staff_task (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES school(id), assigned_to TEXT NOT NULL REFERENCES account(id),
      title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','completed')),
      note TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0)
    );
    CREATE TABLE IF NOT EXISTS school_activity (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES school(id), actor_id TEXT NOT NULL REFERENCES account(id),
      target_id TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL, happened_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS request_school ON school_request(school_id, account_id);
    CREATE INDEX IF NOT EXISTS task_assignee ON staff_task(assigned_to, school_id);
    CREATE INDEX IF NOT EXISTS notice_school ON school_notice(school_id, happened_at);
    CREATE INDEX IF NOT EXISTS register_day ON register(day, class_id);
`;

export async function initializeDatabase(db: Database) {
  // Rebuild the original role CHECK atomically; existing IDs, credentials, sessions,
  // assignments and attendance-event references remain unchanged.
  await write(db, async (tx) => {
    const previous = await one<{ sql: string }>(
      tx,
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account'",
    );
    if (previous && !previous.sql.includes("'parent'")) {
      await tx.execute('PRAGMA defer_foreign_keys = ON');
      await tx.execute(`CREATE TABLE account_expanded (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('administrator','teacher','principal','officer','commissioner','parent','clerk','accountant','librarian','support')),
        password_hash TEXT NOT NULL
      )`);
      await tx.execute(
        'INSERT INTO account_expanded SELECT id, username, name, role, password_hash FROM account',
      );
      await tx.execute('DROP TABLE account');
      await tx.execute('ALTER TABLE account_expanded RENAME TO account');
      const integrity = await tx.execute('PRAGMA foreign_key_check');
      if (integrity.rows.length)
        throw new Error(
          'Account migration failed referential integrity checks.',
        );
      // DROP records deferred violations against the removed table. After checking
      // the replacement, clear that deferred counter before the atomic commit.
      await tx.execute('PRAGMA defer_foreign_keys = OFF');
    }
  });
  await db.batch(
    schema
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean),
    'write',
  );
}

export function openFileDatabase(path: string) {
  if (path === ':memory:')
    throw new Error('ERP requires a persistent database file.');
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  return createClient({ url: pathToFileURL(absolutePath).href });
}

export function configuredDatabase(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.TURSO_DATABASE_URL ||
    env.TURSO_AUTH_TOKEN ||
    env.RENDER === 'true' ||
    env.RENDER_EXTERNAL_URL
  ) {
    const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = env;
    const endpoint = url && new URL(url);
    if (
      !endpoint ||
      !authToken ||
      !['libsql:', 'https:'].includes(endpoint.protocol) ||
      endpoint.searchParams.getAll('tls').includes('0')
    )
      throw new Error(
        'Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for shared storage.',
      );
    return createClient({ url: endpoint.href, authToken });
  }
  if (!env.ERP_DB_PATH)
    throw new Error('Set ERP_DB_PATH for local development.');
  return openFileDatabase(env.ERP_DB_PATH);
}

export async function one<T>(db: Query, sql: string, ...args: InValue[]) {
  return (await db.execute({ sql, args })).rows[0] as T | undefined;
}

export async function many<T>(db: Query, sql: string, ...args: InValue[]) {
  return (await db.execute({ sql, args })).rows as T[];
}

export async function run(db: Query, sql: string, ...args: InValue[]) {
  await db.execute({ sql, args });
}

// A single app process queues writes instead of competing with its own open write transactions.
const pendingWrites = new WeakMap<Database, Promise<unknown>>();

export function write<T>(
  db: Database,
  action: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const previous = pendingWrites.get(db) ?? Promise.resolve();
  const result = previous.then(async () => {
    const tx = await db.transaction('write');
    try {
      const value = await action(tx);
      await tx.commit();
      return value;
    } finally {
      // Closing a transaction before committing rolls it back.
      tx.close();
    }
  });
  const settled = result.catch(() => undefined);
  pendingWrites.set(db, settled);
  void settled.then(() => {
    if (pendingWrites.get(db) === settled) pendingWrites.delete(db);
  });
  return result;
}
