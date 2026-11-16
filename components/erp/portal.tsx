'use client';
import { RecordPreview } from './record-preview';

import { useEffect, useState, type SubmitEvent } from 'react';
import {
  Bell,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { roleLabels, type SchoolPortal, type Workspace } from '@/lib/erp/model';
import { request, errorMessage } from './client';
import { MaintenancePanel } from './maintenance';
import { LibraryPanel } from './library';
import { LearningPanel } from './learning';
import { TeacherPanel } from './teacher';
import { OversightPanel } from './oversight';
import { OperationsPanel } from './operations';
import { PrincipalPanel } from './principal';
import { initialPortalView, portalLinks, portalLinkActive } from './navigation';

const roleCopy = {
  parent: {
    title: 'Family overview',
    text: 'Attendance, school notices and requests for linked students.',
    work: 'My children',
    category: 'leave',
  },
  principal: {
    title: 'School leadership',
    text: 'Attendance, staff assignments, approvals and academic reports.',
    work: 'Staff tasks',
    category: 'general',
  },
  clerk: {
    title: 'School office',
    text: 'Admissions, student records and office requests.',
    work: 'Office work',
    category: 'general',
  },
  accountant: {
    title: 'Accounts & administration',
    text: 'Grant allocations, expenditure, payroll records and finance requests.',
    work: 'Accounts work',
    category: 'finance',
  },
  librarian: {
    title: 'Library & learning resources',
    text: 'Manage catalogue titles and copies, issue and return books, and follow up student borrowing.',
    work: 'Library work',
    category: 'library',
  },
  support: {
    title: 'Facilities and maintenance',
    text: 'Assigned repairs, progress reports and principal verification.',
    work: 'My assigned work',
    category: 'maintenance',
  },
};

export function PortalPanel({
  workspace,
  date,
  onOpenRegister,
  onOpenReport,
  activeView,
  onViewChange,
  hideNavigation = false,
}: {
  workspace: Workspace;
  date: string;
  onOpenRegister?: (classId: string) => void;
  onOpenReport?: () => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
  hideNavigation?: boolean;
}) {
  const { account, schools } = workspace;
  const parent = account.role === 'parent';
  const leader =
    account.role === 'principal' || account.role === 'administrator';
  const directory = leader || account.role === 'clerk';
  const copy = roleCopy[account.role as keyof typeof roleCopy] ?? {
    title: 'School workspace',
    text: 'Staff tasks, school notices and requests.',
    work: 'School team work',
    category: 'general',
  };
  const [data, setData] = useState<SchoolPortal>();
  const [localView, setLocalView] = useState(initialPortalView(account.role));
  const view = activeView ?? localView;
  const delegated =
    /^(principal-|teacher-|learning|operations|library-|maintenance-)|^oversight$/.test(
      view,
    );
  function setView(id: string) {
    setLocalView(id);
    onViewChange?.(id);
    setForm(false);
    setMessage('');
  }
  const [form, setForm] = useState(false);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<SchoolPortal>(
      `portal?date=${encodeURIComponent(date)}`,
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, [date, reload]);
  const [previousView, setPreviousView] = useState(view);
  if (previousView !== view) {
    setPreviousView(view);
    setForm(false);
    setMessage('');
  }
  async function save(event: SubmitEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    if (busy) return;
    const target = event.currentTarget;
    const payload = Object.fromEntries(new FormData(target));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('portal', {
        ...payload,
        ...(payload.version ? { version: Number(payload.version) } : {}),
        action,
      });
      setData(
        await request<SchoolPortal>(`portal?date=${encodeURIComponent(date)}`),
      );
      target.reset();
      setForm(false);
      setMessage(
        action === 'request'
          ? 'Request sent to your school.'
          : action === 'complete'
            ? 'Task completed. Your note has been saved.'
            : action === 'respond'
              ? 'Response saved.'
              : action === 'notice'
                ? 'Notice published.'
                : 'Work assigned.',
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const schoolField = (
    <label>
      School
      <select
        name="schoolId"
        required
        value={schoolId}
        onChange={(event) => setSchoolId(event.target.value)}
      >
        {!schools.length && <option value="">No school assigned</option>}
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="erp-card erp-portal">
      {!hideNavigation && (
        <header className="erp-card-title">
          <div>
            <span className="erp-eyebrow">{roleLabels[account.role]}</span>
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
          </div>
          <button type="button" onClick={() => setReload(reload + 1)}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </header>
      )}
      {hideNavigation && !delegated && (
        <div className="erp-panel-toolbar">
          <button type="button" onClick={() => setReload(reload + 1)}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      )}
      {!hideNavigation && (
        <nav
          className="erp-section-tabs"
          aria-label="School community sections"
        >
          {portalLinks(account.role).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={
                portalLinkActive(view, id, account.role) ? 'page' : undefined
              }
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {view.startsWith('maintenance-') && (
        <MaintenancePanel
          workspace={workspace}
          view={view.replace('maintenance-', '')}
          onNavigate={(id) => setView(`maintenance-${id}`)}
          onOffice={() => setView('oversight')}
        />
      )}
      {view.startsWith('library-') && (
        <LibraryPanel
          key={view}
          workspace={workspace}
          view={view.replace('library-', '')}
          onNavigate={(id) => setView(`library-${id}`)}
        />
      )}
      {view === 'oversight' && (
        <OversightPanel workspace={workspace} date={date} />
      )}
      {view.startsWith('operations') && (
        <OperationsPanel
          key={view}
          workspace={workspace}
          initialView={view.replace('operations-', '')}
        />
      )}
      {view.startsWith('teacher-') && (
        <TeacherPanel
          key={`${date}:${view}`}
          workspace={workspace}
          date={date}
          view={view.replace('teacher-', '')}
          embedded={hideNavigation}
          onNavigate={setView}
          onOpenRegister={onOpenRegister}
        />
      )}
      {view.startsWith('learning') && (
        <LearningPanel
          key={`${date}:${view}`}
          workspace={workspace}
          date={date}
          initialView={parent ? view.replace('learning-', '') : 'academics'}
          hideNavigation={parent}
          onNavigate={parent ? (id) => setView(`learning-${id}`) : undefined}
          notices={data?.notices}
        />
      )}
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data ? (
        <output>Loading your school workspace…</output>
      ) : (
        <>
          {view.startsWith('principal-') && account.role === 'principal' && (
            <PrincipalPanel
              key={`${date}:${view}:${reload}`}
              workspace={workspace}
              date={date}
              portal={data}
              view={view.replace('principal-', '')}
              onRefresh={() => setReload((value) => value + 1)}
              onNavigate={setView}
              onOpenRegister={onOpenRegister}
              onOpenReport={onOpenReport}
            />
          )}
          {view === 'home' && (
            <>
              <div className="erp-portal-metrics">
                <div>
                  <GraduationCap size={18} />
                  <strong>
                    {parent
                      ? data.children.length
                      : data.tasks.filter((task) => task.status === 'open')
                          .length}
                  </strong>
                  <span>{parent ? 'Linked children' : 'Open tasks'}</span>
                </div>
                <div>
                  <MessageSquare size={18} />
                  <strong>
                    {
                      data.requests.filter((row) => row.status === 'open')
                        .length
                    }
                  </strong>
                  <span>Open requests in your view</span>
                </div>
                <div>
                  <Bell size={18} />
                  <strong>{data.notices.length}</strong>
                  <span>School notices</span>
                </div>
              </div>
              {parent ? (
                <div className="erp-child-grid">
                  {data.children.map((child) => (
                    <article className="erp-child-card" key={child.id}>
                      <div className="erp-child-icon">
                        <GraduationCap size={24} />
                      </div>
                      <span className="erp-eyebrow">
                        Linked student · Roll {child.roll}
                      </span>
                      <h3>{child.name}</h3>
                      <p>{child.classLabel}</p>
                      <small>{child.schoolName}</small>
                      <div className="erp-child-attendance">
                        <span>Attendance · {date}</span>
                        <strong
                          className={`erp-status erp-${child.mark ?? 'not-submitted'}`}
                        >
                          {child.mark === 'present'
                            ? 'Present'
                            : child.mark === 'absent'
                              ? 'Absent'
                              : child.mark === 'leave'
                                ? 'On leave'
                                : child.status === 'returned'
                                  ? 'Being corrected'
                                  : 'Not yet reported'}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSchoolId(child.schoolId);
                          setView('requests');
                          setForm(true);
                        }}
                      >
                        Contact school <MessageSquare size={14} />
                      </button>
                    </article>
                  ))}
                  {!data.children.length && (
                    <Empty
                      title="No linked child for this date"
                      text="Ask the administrator to link your account to your child's enrolment. You cannot view other children's records."
                    />
                  )}
                </div>
              ) : (
                <>
                  <div className="erp-portal-section-heading">
                    <h3>
                      <ClipboardList size={16} />
                      {copy.work}
                    </h3>
                    {leader && (
                      <button type="button" onClick={() => setForm(!form)}>
                        <Plus size={14} />
                        Assign work
                      </button>
                    )}
                  </div>
                  {leader && form && (
                    <form
                      className="erp-portal-form"
                      onSubmit={(event) => void save(event, 'task')}
                    >
                      {schoolField}
                      <label>
                        Staff member
                        <select name="assignedTo" required defaultValue="">
                          <option value="" disabled>
                            Choose staff
                          </option>
                          {data.staff
                            .filter((staff) => staff.schoolId === schoolId)
                            .map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.name} · {roleLabels[staff.role]}
                              </option>
                            ))}
                        </select>
                      </label>
                      <TitleFields label="Task details" />
                      <button
                        className="erp-primary"
                        disabled={busy || !schools.length}
                      >
                        Assign task
                      </button>
                    </form>
                  )}
                  <RecordPreview
                    key={`${view}:0`}
                    className="erp-portal-records"
                    label="School community records"
                  >
                    {data.tasks.map((task) => (
                      <article key={task.id} className="erp-portal-record">
                        <header>
                          <div>
                            <span className="erp-eyebrow">
                              {task.schoolName}
                            </span>
                            <h3>{task.title}</h3>
                          </div>
                          <span className={`erp-status erp-${task.status}`}>
                            {task.status}
                          </span>
                        </header>
                        <p>{task.body}</p>
                        <small>Assigned to {task.assignee}</small>
                        {task.note && <blockquote>{task.note}</blockquote>}
                        {task.status === 'open' &&
                          task.assignedTo === account.id && (
                            <details>
                              <summary>
                                <CheckCheck size={14} />
                                Complete this task
                              </summary>
                              <form
                                onSubmit={(event) =>
                                  void save(event, 'complete')
                                }
                              >
                                <input
                                  type="hidden"
                                  name="id"
                                  value={task.id}
                                />
                                <input
                                  type="hidden"
                                  name="schoolId"
                                  value={task.schoolId}
                                />
                                <input
                                  type="hidden"
                                  name="version"
                                  value={task.version}
                                />
                                <label>
                                  Completion note
                                  <textarea
                                    name="note"
                                    required
                                    maxLength={1000}
                                  />
                                </label>
                                <button className="erp-primary" disabled={busy}>
                                  Save completion
                                </button>
                              </form>
                            </details>
                          )}
                      </article>
                    ))}
                    {!data.tasks.length && (
                      <Empty
                        title="No assigned work yet"
                        text="Your principal can assign work here. Completed work keeps its completion note."
                      />
                    )}
                  </RecordPreview>
                </>
              )}
              <div className="erp-portal-next">
                <button
                  type="button"
                  onClick={() => {
                    setView('requests');
                    setForm(true);
                  }}
                >
                  <MessageSquare size={16} />
                  {parent
                    ? 'Send a request to school'
                    : 'Raise a school request'}
                </button>
                <button type="button" onClick={() => setView('notices')}>
                  <Bell size={16} />
                  Read school notices
                </button>
              </div>
            </>
          )}
          {view === 'requests' && (
            <>
              <div className="erp-portal-section-heading">
                <h3>Requests & school replies</h3>
                <button type="button" onClick={() => setForm(!form)}>
                  <Plus size={14} />
                  New request
                </button>
              </div>
              {form && (
                <form
                  className="erp-portal-form"
                  onSubmit={(event) => void save(event, 'request')}
                >
                  {schoolField}
                  {parent && (
                    <label>
                      Linked child
                      <select name="studentId" required defaultValue="">
                        <option value="" disabled>
                          Choose your child
                        </option>
                        {data.children
                          .filter((child) => child.schoolId === schoolId)
                          .map((child) => (
                            <option key={child.id} value={child.id}>
                              {child.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Category
                    <select name="category" defaultValue={copy.category}>
                      {[
                        ...(parent ? [['leave', 'Leave / absence']] : []),
                        ['general', 'School enquiry'],
                        ['finance', 'Accounts / grants'],
                        ['library', 'Library / learning resources'],
                        ['maintenance', 'Maintenance / facilities'],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TitleFields label="Request details (include dates where needed)" />
                  <p className="erp-directory-help">
                    Requests and school replies do not change the teacher’s
                    attendance register.
                  </p>
                  <button
                    className="erp-primary"
                    disabled={busy || !schools.length}
                  >
                    Send request
                  </button>
                </form>
              )}
              <RecordPreview
                key={`${view}:1`}
                className="erp-portal-records"
                label="School community records"
              >
                {data.requests.map((row) => (
                  <article key={row.id} className="erp-portal-record">
                    <header>
                      <div>
                        <span className="erp-eyebrow">
                          {row.category} · {row.schoolName}
                        </span>
                        <h3>{row.title}</h3>
                      </div>
                      <span className={`erp-status erp-${row.status}`}>
                        {row.status}
                      </span>
                    </header>
                    <p>{row.body}</p>
                    <small>
                      From {row.author}
                      {row.studentName ? ` · ${row.studentName}` : ''} ·{' '}
                      {new Date(row.at).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </small>
                    {row.response && (
                      <blockquote>
                        <strong>School reply</strong>
                        {row.response}
                      </blockquote>
                    )}
                    {row.status === 'open' &&
                      row.accountId !== account.id &&
                      (leader ||
                        account.role === 'clerk' ||
                        (
                          {
                            accountant: 'finance',
                            librarian: 'library',
                            support: 'maintenance',
                          } as Record<string, string>
                        )[account.role] === row.category) && (
                        <details>
                          <summary>Respond to request</summary>
                          <form
                            onSubmit={(event) => void save(event, 'respond')}
                          >
                            <input type="hidden" name="id" value={row.id} />
                            <input
                              type="hidden"
                              name="schoolId"
                              value={row.schoolId}
                            />
                            <input
                              type="hidden"
                              name="version"
                              value={row.version}
                            />
                            <label>
                              School response
                              <textarea
                                name="response"
                                required
                                maxLength={1000}
                              />
                            </label>
                            <label>
                              Outcome
                              <select name="status">
                                <option value="resolved">Resolved</option>
                                <option value="declined">Declined</option>
                              </select>
                            </label>
                            <button className="erp-primary" disabled={busy}>
                              Save response
                            </button>
                          </form>
                        </details>
                      )}
                  </article>
                ))}
                {!data.requests.length && (
                  <Empty
                    title="No requests yet"
                    text="Send an enquiry or request and follow the school's reply here."
                  />
                )}
              </RecordPreview>
            </>
          )}
          {view === 'notices' && (
            <>
              <div className="erp-portal-section-heading">
                <h3>From your school</h3>
                {leader && (
                  <button type="button" onClick={() => setForm(!form)}>
                    <Plus size={14} />
                    Publish notice
                  </button>
                )}
              </div>
              {leader && form && (
                <form
                  className="erp-portal-form"
                  onSubmit={(event) => void save(event, 'notice')}
                >
                  {schoolField}
                  <label>
                    Audience
                    <select name="audience">
                      <option value="all">Parents & staff</option>
                      <option value="parents">Parents only</option>
                      <option value="staff">Staff only</option>
                    </select>
                  </label>
                  <TitleFields label="Notice" />
                  <button
                    className="erp-primary"
                    disabled={busy || !schools.length}
                  >
                    Publish notice
                  </button>
                </form>
              )}
              <RecordPreview
                key={`${view}:2`}
                className="erp-portal-records"
                label="School community records"
              >
                {data.notices.map((notice) => (
                  <article className="erp-portal-record" key={notice.id}>
                    <span className="erp-eyebrow">
                      {notice.schoolName} ·{' '}
                      {notice.audience === 'all'
                        ? 'Parents & staff'
                        : notice.audience}
                    </span>
                    <h3>
                      <Bell size={16} />
                      {notice.title}
                    </h3>
                    <p>{notice.body}</p>
                    <small>
                      {notice.author} ·{' '}
                      {new Date(notice.at).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </small>
                  </article>
                ))}
                {!data.notices.length && (
                  <Empty
                    title="No notices yet"
                    text="School leadership can publish announcements for parents, staff, or both."
                  />
                )}
              </RecordPreview>
            </>
          )}
          {view === 'directory' && directory && (
            <>
              <p className="erp-directory-help">
                Learners enrolled on the selected date. Showing up to 200
                records from your assigned schools.
              </p>
              <div className="erp-scroll">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Roll</th>
                      <th>Class</th>
                      <th>School</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.directory.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.roll}</td>
                        <td>{student.classLabel}</td>
                        <td>{student.schoolName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.directory.length && (
                <Empty
                  title="No learner records"
                  text="No enrolments are effective on the selected date in your assigned schools."
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
function TitleFields({ label }: { label: string }) {
  return (
    <>
      <label>
        Subject
        <input name="title" required maxLength={120} />
      </label>
      <label>
        {label}
        <textarea name="body" required maxLength={2000} />
      </label>
    </>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="erp-empty-state">
      <Users size={24} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
