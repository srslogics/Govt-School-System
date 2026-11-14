'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import { roleLabels, schoolStaffRoles, type Workspace } from '@/lib/erp/model';
import { OversightPanel } from './oversight';
import { PortalPanel } from './portal';
import { RegisterPanel, ReportPanel } from './attendance';
import { SetupPanel } from './setup';
import { errorMessage, request, RequestError } from './client';

type Initial = { classId?: string; date?: string };
const roleLabel = roleLabels;

export function ErpWorkspace({ initial }: { initial: Initial }) {
  const [loginName, setLoginName] = useState('');
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
    <main className={`erp-shell${workspace ? '' : ' erp-signed-out'}`}>
      {loading ? (
        <output className="erp-loading">Opening your workspace…</output>
      ) : workspace ? (
        <SignedWorkspace
          key={workspace.account.id}
          workspace={workspace}
          initial={initial}
          busy={busy}
          error={error}
          onSignOut={() => void signOut()}
          refresh={() => {
            void request<Workspace>('session')
              .then(setWorkspace)
              .catch((failure: unknown) => {
                if (failure instanceof RequestError && failure.status === 401)
                  setWorkspace(undefined);
                setError(errorMessage(failure));
              });
          }}
        />
      ) : (
        <div className="erp-login-layout">
          <section className="erp-login-intro">
            <Brand />
            <div className="erp-login-story">
              <span className="erp-eyebrow">SCHOOL OPERATIONS, CONNECTED</span>
              <h1>
                Every school.
                <br />
                One clear picture.
              </h1>
              <p>
                From the classroom register to the education office. A simpler
                way to record, review and understand school attendance.
              </p>
              <div className="erp-login-steps">
                <div>
                  <ClipboardCheck size={20} />
                  <span>
                    <strong>Record with confidence</strong>
                    <small>Class attendance, saved in one place.</small>
                  </span>
                </div>
                <div>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Review with context</strong>
                    <small>Corrections and an accountable history.</small>
                  </span>
                </div>
                <div>
                  <LayoutDashboard size={20} />
                  <span>
                    <strong>See the whole picture</strong>
                    <small>School summaries and submission coverage.</small>
                  </span>
                </div>
              </div>
            </div>
            <p className="erp-login-disclaimer">
              Independent demonstration · Fictional records · No NMC endorsement
            </p>
          </section>
          <section className="erp-login-side">
            <div className="erp-login">
              <span className="erp-pilot-badge">
                <span /> SHARED ATTENDANCE PILOT
              </span>
              <h2>Welcome to Shiksha-Setu</h2>
              <p>
                Choose a pilot workspace, then use its assigned credentials.
              </p>
              {!unavailable && (
                <div className="erp-role-picker">
                  <p>WORKSPACES FOR THE WHOLE SCHOOL</p>
                  <div className="erp-role-options">
                    {[
                      ['parent.a', 'Parent / guardian'],
                      ['teacher.a', 'Teacher'],
                      ['principal.a', 'Principal'],
                      ['office.a', 'School office'],
                      ['accounts.a', 'Accounts staff'],
                      ['library.a', 'Librarian'],
                      ['support.a', 'Support staff'],
                      ['officer.a', 'Education officer'],
                      ['commissioner', 'Commissioner'],
                      ['admin', 'Administrator'],
                    ].map(([username, label]) => (
                      <button
                        key={username}
                        type="button"
                        aria-pressed={loginName === username}
                        onClick={() => setLoginName(username)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                      value={loginName}
                      onChange={(event) => setLoginName(event.target.value)}
                      required
                      autoComplete="username"
                      maxLength={64}
                      placeholder="Enter your username"
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
                      placeholder="Enter your password"
                    />
                  </label>
                  <button className="erp-primary" disabled={busy}>
                    {busy ? 'Signing in…' : 'Open workspace'}
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}
              <div className="erp-login-note">
                <ShieldCheck size={18} />
                <p>
                  Your account opens only the schools and classes assigned to
                  you.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Brand() {
  return (
    <div className="erp-brand">
      <span className="erp-brand-mark">
        <GraduationCap size={24} />
      </span>
      <span>
        <strong>Shiksha-Setu</strong>
        <small>School operations</small>
      </span>
    </div>
  );
}

function SignedWorkspace({
  workspace,
  initial,
  refresh,
  busy,
  error,
  onSignOut,
}: {
  workspace: Workspace;
  initial: Initial;
  refresh: () => void;
  busy: boolean;
  error: string;
  onSignOut: () => void;
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
    account.role === 'officer'
      ? 'oversight'
      : account.role === 'administrator'
        ? 'setup'
        : allowedInitial
          ? 'register'
          : account.role === 'teacher' ||
              account.role === 'principal' ||
              account.role === 'parent' ||
              ['clerk', 'accountant', 'librarian', 'support'].includes(
                account.role,
              )
            ? 'portal'
            : 'report',
  );
  const scopedClasses = classes.filter((row) => row.schoolId === schoolId);
  const selectedClass =
    scopedClasses.find((row) => row.id === classId) ?? scopedClasses[0];
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

  const title =
    tab === 'oversight'
      ? 'School oversight'
      : tab === 'setup'
        ? 'School administration'
        : tab === 'portal'
          ? account.role === 'parent'
            ? 'Family workspace'
            : account.role === 'principal'
              ? 'School leadership'
              : `${roleLabels[account.role]} workspace`
          : tab === 'register'
            ? 'Class attendance'
            : account.role === 'principal'
              ? 'School overview'
              : 'Attendance overview';
  const description =
    tab === 'oversight'
      ? 'Monitor assigned schools, coordinate inspections and follow up decisions and compliance.'
      : tab === 'setup'
        ? 'Manage your schools, people and access, one step at a time.'
        : tab === 'portal'
          ? account.role === 'parent'
            ? 'A closer connection to your child’s school.'
            : 'One place for your school work, requests and announcements.'
          : tab === 'register'
            ? 'Mark the register, submit for review and keep every correction on record.'
            : 'See attendance, spot missing submissions and follow up where it matters.';
  return (
    <div className="erp-layout">
      <aside className="erp-sidebar">
        <Brand />
        <div className="erp-workspace-label">YOUR WORKSPACE</div>
        <nav className="erp-nav" aria-label="School workspace">
          {['officer', 'commissioner'].includes(account.role) && (
            <button
              type="button"
              aria-current={tab === 'oversight' ? 'page' : undefined}
              onClick={() => {
                setBadLink(false);
                setTab('oversight');
              }}
            >
              <Building2 size={18} />
              {account.role === 'officer'
                ? 'School oversight'
                : 'School oversight & escalations'}
            </button>
          )}
          {account.role === 'administrator' && (
            <button
              aria-current={tab === 'setup' ? 'page' : undefined}
              type="button"
              onClick={() => {
                setBadLink(false);
                setTab('setup');
              }}
            >
              <Settings2 size={18} />
              School administration
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
              <LayoutDashboard size={18} />
              {account.role === 'principal' || account.role === 'officer'
                ? 'Attendance reports'
                : 'Overview & reports'}
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
              <BookOpen size={18} />
              Attendance register
            </button>
          )}
          {(account.role === 'parent' ||
            schoolStaffRoles.includes(account.role) ||
            account.role === 'administrator') && (
            <button
              type="button"
              aria-current={tab === 'portal' ? 'page' : undefined}
              onClick={() => {
                setBadLink(false);
                setTab('portal');
              }}
            >
              <GraduationCap size={18} />
              {account.role === 'parent'
                ? 'My family'
                : account.role === 'principal'
                  ? 'School dashboard'
                  : account.role === 'administrator'
                    ? 'Team & families'
                    : 'My school workspace'}
            </button>
          )}
        </nav>
        <div className="erp-sidebar-context">
          <Building2 size={20} />
          <strong>
            {schools.length} {schools.length === 1 ? 'school' : 'schools'} in
            your workspace
          </strong>
          <p>Access follows your assigned role and school scope.</p>
        </div>
        <div className="erp-sidebar-bottom">
          <details className="erp-preview-menu">
            <summary>
              Explore other modules <ChevronRight size={14} />
            </summary>
            <p>
              Reference previews use fictional records saved in this browser and
              a separate sign-in.
            </p>
            <Link href="/preview">Open reference previews</Link>
          </details>
          <div className="erp-profile">
            <span className="erp-avatar">
              {account.name
                .split(' ')
                .filter(Boolean)
                .slice(-2)
                .map((word) => word[0])
                .join('')}
            </span>
            <div>
              <strong>{account.name}</strong>
              <small>{roleLabel[account.role]}</small>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={onSignOut}
              disabled={busy}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="erp-content">
        <header className="erp-topbar">
          <span>
            <Landmark size={15} /> Nagpur · School operations
          </span>
          <span className="erp-pilot-badge">
            <span /> FICTIONAL DATA PILOT
          </span>
        </header>
        <div className="erp-main">
          <header className="erp-page-title">
            <div>
              <p>{roleLabel[account.role]} workspace</p>
              <h1>{title}</h1>
              <span>{description}</span>
            </div>
            <div className="erp-date-stamp">
              {new Intl.DateTimeFormat('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Asia/Kolkata',
              }).format(new Date(workspace.date + 'T00:00:00+05:30'))}
            </div>
          </header>
          {error && (
            <p className="erp-error" role="alert">
              {error}
            </p>
          )}
          {tab !== 'setup' && (
            <div className="erp-filters">
              {tab !== 'portal' && tab !== 'oversight' && (
                <label>
                  School
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
              )}
              <label>
                Date
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
          ) : tab === 'oversight' ? (
            <OversightPanel
              workspace={workspace}
              date={date}
              onOpenReports={() => setTab('report')}
            />
          ) : tab === 'portal' ? (
            <PortalPanel
              key={date}
              workspace={workspace}
              date={date}
              onOpenRegister={openRegister}
              onOpenReport={() => {
                setBadLink(false);
                setTab('report');
              }}
            />
          ) : tab === 'setup' ? (
            <SetupPanel date={workspace.date} onSaved={refresh} />
          ) : tab === 'report' ? (
            <ReportPanel
              key={`${date}:${schoolId}`}
              date={date}
              schoolId={schoolId}
              canReview={account.role === 'principal'}
              onOpen={openRegister}
              onSchool={(id) => {
                setSchoolId(id);
                setClassId('');
              }}
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
              No class is available in this workspace. Ask the setup
              administrator to check your assignment.
            </p>
          )}
          <footer className="erp-footer">
            <span>Shiksha-Setu · Shared school operations</span>
            <span>
              Independent pilot · No government connection or endorsement
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
