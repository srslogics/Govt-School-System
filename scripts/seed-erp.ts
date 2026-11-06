import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  configuredDatabase,
  initializeDatabase,
  one,
} from '../lib/erp/database';
import { fictionalAccounts, seedFictionalSchools } from '../lib/erp/seed';

const localPath = process.env.ERP_DB_PATH;
const remote = Boolean(
  process.env.TURSO_DATABASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  process.env.RENDER === 'true',
);
const credentialsPath = resolve(
  process.env.ERP_ACCOUNTS_FILE ||
    (remote ? '.erp-data/hosted.accounts.json' : `${localPath}.accounts.json`),
);
const accounts = fictionalAccounts.map(([username, , role]) => ({
  username,
  role,
  password: randomBytes(18).toString('base64url'),
}));
const passwords = new Map(
  accounts.map(({ username, password }) => [username, password]),
);
const db = configuredDatabase();
try {
  await initializeDatabase(db);
  if (await one(db, 'SELECT 1 FROM account LIMIT 1'))
    throw new Error(
      'Pilot database already contains accounts. Use the original credentials.',
    );
  mkdirSync(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  writeFileSync(credentialsPath, JSON.stringify(accounts, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  // Keep the credentials if a network interruption makes a remote commit outcome uncertain.
  try {
    await seedFictionalSchools(db, (username) => passwords.get(username) ?? '');
  } catch (error) {
    if (!remote) unlinkSync(credentialsPath);
    throw error;
  }
  console.log(
    'Two fictional schools and seven individually credentialed pilot accounts are ready.',
  );
  console.log('Private account file:', credentialsPath);
} finally {
  db.close();
}
