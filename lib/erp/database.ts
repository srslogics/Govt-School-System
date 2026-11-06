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
      role TEXT NOT NULL CHECK(role IN ('administrator','teacher','principal','officer','commissioner')),
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
    CREATE INDEX IF NOT EXISTS register_day ON register(day, class_id);
`;

export async function initializeDatabase(db: Database) {
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
