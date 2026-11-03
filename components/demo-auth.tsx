'use client';

import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  createContext,
  type ReactNode,
  type SyntheticEvent,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  accounts,
  canonicalSession,
  type DemoSession,
} from '@/lib/demo-accounts';
export type { DemoSession } from '@/lib/demo-accounts';

type AuthContextValue = {
  session: DemoSession;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = 'shikshan-setu-demo-session';

export function useDemoAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useDemoAuth must be used within DemoAuthGate');
  return value;
}

export function DemoAuthGate({ children }: { children: ReactNode }) {
  const [storageWarning, setStorageWarning] = useState('');
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<DemoSession | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = window.localStorage.getItem(SESSION_KEY);
        if (stored) {
          const restored = canonicalSession(JSON.parse(stored));
          if (restored) setSession(restored);
          else
            setStorageWarning(
              'The saved demo profile was invalid. Please sign in again.',
            );
        }
      } catch {
        setStorageWarning(
          'Browser storage is unavailable or invalid. You can sign in for this visit.',
        );
      }
      setReady(true);
    });
  }, []);

  const login = (account: DemoSession) => {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(account));
    } catch {
      setStorageWarning(
        'Storage is unavailable. This demo session lasts only for this visit.',
      );
    }
    setSession(account);
  };

  const logout = () => {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      setStorageWarning(
        'Storage could not be cleared. This visit is signed out; check browser storage before reloading.',
      );
    }
    setSession(null);
  };

  if (!ready) {
    return (
      <main className="auth-loading" aria-label="Loading">
        <Landmark size={28} />
      </main>
    );
  }

  if (!session)
    return (
      <>
        <output className="demo-storage-warning">{storageWarning}</output>
        <LoginScreen onLogin={login} />
      </>
    );

  return (
    <AuthContext.Provider value={{ session, logout }}>
      {storageWarning && (
        <output className="demo-storage-warning">{storageWarning}</output>
      )}
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen({ onLogin }: { onLogin: (account: DemoSession) => void }) {
  const [selectedId, setSelectedId] = useState(accounts[0].userId);
  const [userId, setUserId] = useState(accounts[0].userId);
  const [password, setPassword] = useState(accounts[0].password);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => accounts.find((account) => account.userId === selectedId)!,
    [selectedId],
  );

  const chooseAccount = (id: string) => {
    const account = accounts.find((item) => item.userId === id)!;
    setSelectedId(id);
    setUserId(account.userId);
    setPassword(account.password);
    setError('');
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const account = accounts.find(
      (item) => item.userId === userId.trim() && item.password === password,
    );
    if (!account) {
      setError('Invalid user ID or password');
      return;
    }
    const { password: _password, ...safeSession } = account;
    onLogin(safeSession);
  };

  return (
    <main className="auth-shell">
      <div className="auth-tricolour">
        <i />
        <i />
        <i />
      </div>
      <section className="auth-frame">
        <div className="auth-identity">
          <div className="auth-seal">
            <Landmark size={30} />
          </div>
          <span className="auth-marathi">शिक्षण सेतु</span>
          <h1>District School Administration System</h1>
          <div className="auth-department">
            <Building2 size={17} />
            <span>
              <strong>District Education Office, Nagpur</strong>
              <small>Government of Maharashtra</small>
            </span>
          </div>
          <dl className="auth-system-record">
            <div>
              <dt>District</dt>
              <dd>Nagpur</dd>
            </div>
            <div>
              <dt>Academic year</dt>
              <dd>2026–27</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Demonstration</dd>
            </div>
          </dl>
        </div>

        <div className="auth-panel">
          <div className="auth-panel-head">
            <span>DEMO ACCESS</span>
            <h2>Sign in</h2>
          </div>

          <form onSubmit={submit}>
            <label>
              Access profile
              <span className="auth-field">
                <UserRound size={16} />
                <select
                  value={selectedId}
                  onChange={(event) => chooseAccount(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.userId} value={account.userId}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <div className="auth-profile-record">
              <span>{selected.office}</span>
              <strong>{selected.role}</strong>
            </div>

            <label>
              User ID
              <span className="auth-field">
                <KeyRound size={16} />
                <input
                  autoComplete="username"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                />
              </span>
            </label>

            <label>
              Password
              <span className="auth-field">
                <LockKeyhole size={16} />
                <input
                  autoComplete="current-password"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={visible ? 'Hide password' : 'Show password'}
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit">
              <ShieldCheck size={17} />
              Sign in
            </button>
          </form>

          <footer>
            <span>Sample account password · Not production authentication</span>
            <code>Nagpur@2026</code>
          </footer>
        </div>
      </section>
      <div className="auth-footer">
        <span>School Education and Sports Department</span>
        <span>DEMONSTRATION DATA</span>
      </div>
    </main>
  );
}
