'use client';

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
  Menu,
  X,
  Search,
  CalendarDays,
  Users,
  FileText,
  Wrench,
  MessageSquare,
  Bell,
  Circle,
} from 'lucide-react';
import {
  useEffect,
  useState,
  useRef,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import { roleLabels, schoolStaffRoles, type Workspace } from '@/lib/erp/model';
import { OversightPanel } from './oversight';
import {
  initialPortalView,
  portalLinks,
  portalLinkActive,
  oversightLinks,
} from './navigation';
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
                A better school day.
                <br />
                For everyone.
              </h1>
              <p>
                Learning, people and daily school operations, connected in one
                thoughtful workspace.
              </p>
              <div className="erp-login-steps">
                <div>
                  <ClipboardCheck size={20} />
                  <span>
                    <strong>Record with confidence</strong>
                    <small>Attendance, learning and daily school work.</small>
                  </span>
                </div>
                <div>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Review with context</strong>
                    <small>
                      Clear responsibilities and recorded decisions.
                    </small>
                  </span>
                </div>
                <div>
                  <LayoutDashboard size={20} />
                  <span>
                    <strong>See the whole picture</strong>
                    <small>Useful insights for every school and office.</small>
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
                <span /> SHIKSHA-SETU BY SS49
              </span>
              <h2>Welcome to Shiksha-Setu</h2>
              <p>
                Choose your workspace and sign in to continue your school day.
              </p>
              {!unavailable && (
                <div className="erp-role-picker">
                  <label htmlFor="workspace-role">Your workspace</label>
                  <select
                    id="workspace-role"
                    value={loginName}
                    onChange={(event) => setLoginName(event.target.value)}
                  >
                    <option value="">Choose your role</option>
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
                      <option key={username} value={username}>
                        {label}
                      </option>
                    ))}
                  </select>
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
        <small>School ERP by SS49</small>
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
    account.role === 'officer' || account.role === 'commissioner'
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
  const [portalView, setPortalView] = useState(initialPortalView(account.role));
  const [oversightView, setOversightView] = useState(
    account.role === 'commissioner' ? 'municipal' : 'overview',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigationSearch, setNavigationSearch] = useState('');
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const showPortal =
    account.role === 'parent' ||
    schoolStaffRoles.includes(account.role) ||
    account.role === 'administrator';
  const communityLinks = showPortal ? portalLinks(account.role) : [];
  const educationLinks = ['officer', 'commissioner'].includes(account.role)
    ? oversightLinks(account.role)
    : [];
  const matches = (label: string) =>
    label.toLowerCase().includes(navigationSearch.trim().toLowerCase());
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = menuButton.current;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = sidebar.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, a, summary',
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1025px)');
    const close = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  function navigate(target: string, view?: string) {
    setBadLink(false);
    setTab(target);
    if (target === 'portal' && view) setPortalView(view);
    if (target === 'oversight' && view) setOversightView(view);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
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

  const sectionLabel =
    tab === 'portal'
      ? communityLinks.find(([id]) =>
          portalLinkActive(portalView, id, account.role),
        )?.[1]
      : tab === 'oversight'
        ? educationLinks.find(([id]) => id === oversightView)?.[1]
        : undefined;
  const title =
    sectionLabel ??
    (tab === 'oversight'
      ? account.role === 'commissioner'
        ? 'Municipal education'
        : 'School oversight'
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
              : 'Attendance overview');
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
      <a className="erp-skip-link" href="#erp-workspace-content">
        Skip to workspace
      </a>
      {mobileOpen && (
        <button
          type="button"
          className="erp-nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="erp-navigation"
        ref={sidebar}
        className={`erp-sidebar${mobileOpen ? ' is-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <div className="erp-sidebar-brand">
          <Brand />
          <button
            className="erp-mobile-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="erp-sidebar-scroll">
          <label className="erp-nav-search">
            <Search size={16} />
            <input
              aria-label="Find a tool"
              placeholder="Find a tool…"
              value={navigationSearch}
              onChange={(event) => setNavigationSearch(event.target.value)}
            />
            {navigationSearch && (
              <button
                type="button"
                aria-label="Clear tool search"
                onClick={() => setNavigationSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <div className="erp-workspace-label">{roleLabel[account.role]}</div>
          <nav className="erp-nav" aria-label="School workspace">
            {educationLinks
              .filter(([, label]) => matches(label))
              .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-current={
                    tab === 'oversight' && oversightView === id
                      ? 'page'
                      : undefined
                  }
                  onClick={() => navigate('oversight', id)}
                >
                  <NavigationIcon id={id} />
                  <span>{label}</span>
                </button>
              ))}
            {communityLinks
              .filter(([, label]) => matches(label))
              .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-current={
                    tab === 'portal' &&
                    portalLinkActive(portalView, id, account.role)
                      ? 'page'
                      : undefined
                  }
                  onClick={() => navigate('portal', id)}
                >
                  <NavigationIcon id={id} />
                  <span>{label}</span>
                </button>
              ))}
            {account.role === 'administrator' &&
              matches('School administration') && (
                <button
                  type="button"
                  aria-current={tab === 'setup' ? 'page' : undefined}
                  onClick={() => navigate('setup')}
                >
                  <Settings2 size={18} />
                  <span>School administration</span>
                </button>
              )}
            {canReport && matches('Attendance reports') && (
              <button
                type="button"
                aria-current={tab === 'report' ? 'page' : undefined}
                onClick={() => navigate('report')}
              >
                <LayoutDashboard size={18} />
                <span>Attendance reports</span>
              </button>
            )}
            {canRegister && matches('Attendance register') && (
              <button
                type="button"
                aria-current={tab === 'register' ? 'page' : undefined}
                onClick={() => navigate('register')}
              >
                <BookOpen size={18} />
                <span>Attendance register</span>
              </button>
            )}
            {navigationSearch &&
              ![
                ...educationLinks,
                ...communityLinks,
                ...(canReport ? [['report', 'Attendance reports']] : []),
                ...(canRegister ? [['register', 'Attendance register']] : []),
                ...(account.role === 'administrator'
                  ? [['setup', 'School administration']]
                  : []),
              ].some(([, label]) => matches(label)) && (
                <output className="erp-nav-empty">
                  No tools match this search.
                </output>
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
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- Reference previews use a separate runtime and sign-in, requiring a full navigation. */}
            <a href="/preview">Open reference previews</a>
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
      <div className="erp-content" inert={mobileOpen}>
        <header className="erp-topbar">
          <div className="erp-topbar-location">
            <button
              ref={menuButton}
              type="button"
              className="erp-menu-toggle"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="erp-navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>
              <Landmark size={16} /> School operations{' '}
              <ChevronRight size={14} />
              <strong>{roleLabel[account.role]}</strong>
            </span>
          </div>
          <span className="erp-topbar-identity">
            <span className="erp-pilot-badge">
              <span /> Meeting demo
            </span>
            <span className="erp-avatar" aria-hidden="true">
              {account.name
                .split(' ')
                .filter(Boolean)
                .slice(-2)
                .map((word) => word[0])
                .join('')}
            </span>
          </span>
        </header>
        <div className="erp-main" id="erp-workspace-content" tabIndex={-1}>
          <header className="erp-page-title">
            <div>
              <p>{roleLabel[account.role]} workspace</p>
              <h1>{title}</h1>
              <span>{description}</span>
            </div>
            <div className="erp-date-stamp">
              <CalendarDays size={16} />
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
              activeView={oversightView}
              onViewChange={setOversightView}
              hideNavigation
              onOpenReports={() => setTab('report')}
            />
          ) : tab === 'portal' ? (
            <PortalPanel
              key={date}
              activeView={portalView}
              onViewChange={setPortalView}
              hideNavigation
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
            <span>Shiksha-Setu by SS49</span>
            <span>
              Independent pilot · No government connection or endorsement
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function NavigationIcon({ id }: { id: string }) {
  const Icon = /timetable|day|calendar/.test(id)
    ? CalendarDays
    : /student|staff|directory/.test(id)
      ? Users
      : /request|escalation/.test(id)
        ? MessageSquare
        : /notice|circular/.test(id)
          ? Bell
          : /maintenance|inventory|resources/.test(id)
            ? Wrench
            : /marks|academics|performance|learning/.test(id)
              ? BookOpen
              : /home|overview|municipal|comparison/.test(id)
                ? LayoutDashboard
                : /library/.test(id)
                  ? BookOpen
                  : /inspection|priorities|history/.test(id)
                    ? FileText
                    : Circle;
  return <Icon size={18} aria-hidden="true" />;
}
