'use client';

import Link from 'next/link';
import { Landmark } from 'lucide-react';
import {
  useEffect,
  useState,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import type { Workspace } from '@/lib/erp/model';
import { RegisterPanel, ReportPanel } from './attendance';
import { SetupPanel } from './setup';
import { errorMessage, request, RequestError } from './client';

type Initial = { classId?: string; date?: string };
const roleLabel = {
  administrator: 'Setup administrator',
  teacher: 'Teacher',
  principal: 'Principal',
  officer: 'Education officer',
  commissioner: 'Commissioner',
};

export function ErpWorkspace({ initial }: { initial: Initial }) {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Workspace>('session', undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setWorkspace(result);
      })
      .catch((failure: unknown) => {
        if (
          controller.signal.aborted ||
          (failure instanceof RequestError && failure.status === 401)
        )
          return;
        setError(errorMessage(failure));
        setUnavailable(
          failure instanceof RequestError && failure.status === 503,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function signIn(event: ReactSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await request('login', fields);
      setWorkspace(await request<Workspace>('session'));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await request('logout', {});
      setWorkspace(undefined);
    } catch (failure) {
      if (failure instanceof RequestError && failure.status === 401)
        setWorkspace(undefined);
      else setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="erp-shell">
      <div className="tricolour">
        <i />
        <i />
        <i />
      </div>
      <header className="erp-masthead">
        <div className="dept-mark">
          <Landmark size={22} aria-hidden="true" />
        </div>
        <div>
          <strong>Shiksha-Setu</strong>
          <p>NMC school operations pilot</p>
        </div>
        <div className="erp-account">
          {workspace && (
            <>
              <span>
                {workspace.account.name} · {roleLabel[workspace.account.role]}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={busy}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>
      <div className="erp-environment">
        Fictional school data · Independent pilot with no NMC connection or
        endorsement
      </div>
      {loading ? (
        <output className="erp-login">Checking your session…</output>
      ) : workspace ? (
        <>
          {error && (
            <p className="erp-error" role="alert">
              {error}
            </p>
          )}
          <SignedWorkspace
            key={workspace.account.id}
            workspace={workspace}
            initial={initial}
            refresh={() => {
              void request<Workspace>('session')
                .then(setWorkspace)
                .catch((failure: unknown) => setError(errorMessage(failure)));
            }}
          />
        </>
      ) : (
        <section className="erp-card erp-login">
          <h1>Sign in to school operations</h1>
          <p>Use your assigned pilot account to access saved school records.</p>
          {error && (
            <p className="erp-error" role="alert">
              {error}
            </p>
          )}
          {!unavailable && (
            <form onSubmit={(event) => void signIn(event)}>
              <label>
                Username
                <input
                  name="username"
                  required
                  autoComplete="username"
                  maxLength={64}
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  maxLength={128}
                />
              </label>
              <button className="erp-primary" disabled={busy}>
                Sign in
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}

function SignedWorkspace({
  workspace,
  initial,
  refresh,
}: {
  workspace: Workspace;
  initial: Initial;
  refresh: () => void;
}) {
  const { account, schools, classes } = workspace;
  const allowedInitial = classes.find((row) => row.id === initial.classId);
  const [badLink, setBadLink] = useState(
    Boolean(initial.classId && !allowedInitial),
  );
  const [schoolId, setSchoolId] = useState(
    allowedInitial?.schoolId ??
      (account.role === 'teacher' || account.role === 'principal'
        ? (schools[0]?.id ?? '')
        : ''),
  );
  const [classId, setClassId] = useState(allowedInitial?.id ?? '');
  const [date, setDate] = useState(initial.date ?? workspace.date);
  const [tab, setTab] = useState(
    account.role === 'administrator'
      ? 'setup'
      : account.role === 'teacher' || allowedInitial
        ? 'register'
        : 'report',
  );
  const scopedClasses = classes.filter((row) => row.schoolId === schoolId);
  const selectedClass =
    scopedClasses.find((row) => row.id === classId) ?? scopedClasses[0];
  const school = schools.find((row) => row.id === schoolId);
  const canReport =
    account.role === 'principal' ||
    account.role === 'officer' ||
    account.role === 'commissioner';
  const canRegister =
    account.role === 'teacher' || account.role === 'principal';
  function openRegister(id: string) {
    const selected = classes.find((row) => row.id === id);
    if (!selected) return;
    setSchoolId(selected.schoolId);
    setClassId(id);
    setTab('register');
    setBadLink(false);
  }

  return (
    <div className="erp-layout">
      <nav className="erp-nav" aria-label="School workspace">
        <span>WORKSPACE</span>
        {account.role === 'administrator' && (
          <button aria-current="page" type="button">
            School setup
          </button>
        )}
        {canRegister && (
          <button
            type="button"
            aria-current={tab === 'register' ? 'page' : undefined}
            onClick={() => {
              setBadLink(false);
              setTab('register');
            }}
          >
            Attendance register
          </button>
        )}
        {canReport && (
          <button
            type="button"
            aria-current={tab === 'report' ? 'page' : undefined}
            onClick={() => {
              setBadLink(false);
              setTab('report');
            }}
          >
            Attendance reports
          </button>
        )}
      </nav>
      <div className="erp-main">
        <header className="erp-page-title">
          <p>{roleLabel[account.role]}</p>
          <h1>
            {school?.name ??
              (account.role === 'administrator'
                ? 'School configuration'
                : account.role === 'commissioner'
                  ? 'Municipal attendance overview'
                  : 'Assigned school operations')}
          </h1>
        </header>
        {tab !== 'setup' && (
          <div className="erp-filters">
            <label>
              School workspace
              <select
                value={schoolId}
                onChange={(event) => {
                  setSchoolId(event.target.value);
                  setClassId('');
                  setBadLink(false);
                }}
              >
                {(account.role === 'officer' ||
                  account.role === 'commissioner') && (
                  <option value="">All schools in scope</option>
                )}
                {!schools.length && canRegister && (
                  <option value="">No school assigned</option>
                )}
                {schools.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Attendance date
              <input
                type="date"
                required
                value={date}
                max={workspace.date}
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value);
                }}
              />
            </label>
            {tab === 'register' && (
              <label>
                Class and section
                <select
                  value={selectedClass?.id ?? ''}
                  onChange={(event) => {
                    setClassId(event.target.value);
                    setBadLink(false);
                  }}
                >
                  {!scopedClasses.length && (
                    <option value="">No class assigned</option>
                  )}
                  {scopedClasses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.grade} · Section {row.section}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {badLink ? (
          <p role="alert" className="erp-error">
            Record not found in your workspace.
          </p>
        ) : tab === 'setup' ? (
          <SetupPanel date={workspace.date} onSaved={refresh} />
        ) : tab === 'report' ? (
          <ReportPanel
            key={`${date}:${schoolId}`}
            date={date}
            schoolId={schoolId}
            canReview={account.role === 'principal'}
            onOpen={openRegister}
          />
        ) : selectedClass ? (
          <RegisterPanel
            key={`${selectedClass.id}:${date}`}
            classId={selectedClass.id}
            date={date}
            role={account.role}
            onSaved={refresh}
          />
        ) : (
          <p>
            No class is available in this workspace. Ask the setup administrator
            to check your assignment.
          </p>
        )}
        <details className="erp-roadmap">
          <summary>Preview modules and planned features</summary>
          <p>
            Shared workflows in this milestone cover school setup, enrolment,
            staff assignments and daily attendance.
          </p>
          <p>
            Next phases cover extended student records, staff and leave,
            timetables, assessments and report cards, parent access and school
            administration.
          </p>
          <p>
            The six reference workspaces and request approvals use sample data
            stored separately in the browser. The previews have their own sign-in.
          </p>
          <p>
            <Link href="/preview">Open preview modules</Link>
          </p>
        </details>
      </div>
    </div>
  );
}
