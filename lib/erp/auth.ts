import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { one, write, run, type Query, type Database } from './database';
import type { Account } from './model';
import { ErpError, requiredText } from './validation';

const cookieName = 'shiksha_erp_session';
const lifetime = 8 * 60 * 60;
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const dummyHash = '00000000000000000000000000000000:' + '0'.repeat(128);

export function passwordHash(password: string) {
  if (password.length < 12 || password.length > 128)
    throw new ErpError(400, 'Use a password of 12 to 128 characters.');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function usernameValue(value: unknown) {
  const username = requiredText(value, 'Username', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username))
    throw new ErpError(
      400,
      'Use 3 to 64 letters, numbers, dots, dashes or underscores.',
    );
  return username;
}

async function consumeLoginAttempt(db: Database, username: string) {
  await write(db, async (tx) => {
    const now = Date.now();
    await run(tx, 'DELETE FROM login_limit WHERE expires_at <= ?', now);
    const keys = ['global', `user:${username}`];
    for (const [index, key] of keys.entries()) {
      const row = await one<{ attempts: number }>(
        tx,
        'SELECT attempts FROM login_limit WHERE key = ?',
        key,
      );
      if ((row?.attempts ?? 0) >= (index === 0 ? 120 : 8))
        throw new ErpError(
          429,
          'Too many sign-in attempts. Try again in 15 minutes.',
        );
    }
    for (const key of keys) {
      await run(
        tx,
        `INSERT INTO login_limit VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1`,
        key,
        now + 900_000,
      );
    }
  });
}

function tokenFrom(request: Request) {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + '='))
    ?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function authenticate(
  db: Query,
  request: Request,
): Promise<Account> {
  const token = tokenFrom(request);
  const account =
    token &&
    (await one<Account>(
      db,
      `
    SELECT a.id, a.username, a.name, a.role FROM account a JOIN session s ON s.account_id = a.id
    WHERE s.token_hash = ? AND s.expires_at > ?`,
      hashToken(token),
      Date.now(),
    ));
  if (!account) throw new ErpError(401, 'Sign in to the shared ERP workspace.');
  return account;
}

export async function clearSession(db: Query, request: Request) {
  const token = tokenFrom(request);
  if (token)
    await run(db, 'DELETE FROM session WHERE token_hash = ?', hashToken(token));
}

export async function login(
  db: Database,
  request: Request,
  usernameInput: unknown,
  password: unknown,
) {
  const username = usernameValue(usernameInput);
  if (typeof password !== 'string' || password.length > 128)
    throw new ErpError(401, 'Invalid username or password.');
  await consumeLoginAttempt(db, username);
  const account = await one<{ id: string; password_hash: string }>(
    db,
    'SELECT id, password_hash FROM account WHERE username = ?',
    username,
  );
  const [salt, digest] = (account?.password_hash ?? dummyHash).split(':');
  if (
    !timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(digest, 'hex'),
    ) ||
    !account
  )
    throw new ErpError(401, 'Invalid username or password.');
  const token = randomBytes(32).toString('hex');
  await write(db, async (tx) => {
    await clearSession(tx, request);
    await run(tx, 'DELETE FROM session WHERE expires_at <= ?', Date.now());
    await run(tx, 'DELETE FROM login_limit WHERE key = ?', `user:${username}`);
    await run(
      tx,
      'INSERT INTO session VALUES (?, ?, ?)',
      hashToken(token),
      account.id,
      Date.now() + lifetime * 1000,
    );
  });
  return token;
}

export function sessionCookie(token: string, secure: boolean) {
  return `${cookieName}=${token}; Path=/api/erp; HttpOnly; SameSite=Strict; Max-Age=${token ? lifetime : 0}${secure ? '; Secure' : ''}`;
}
