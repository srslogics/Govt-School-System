'use client';
import { RecordPreview } from './record-preview';

import { useEffect, useState, type SubmitEvent } from 'react';
import type { Workspace } from '@/lib/erp/model';
import type { MaintenanceTicket, MaintenanceView } from '@/lib/erp/maintenance';
import { errorMessage, request } from './client';
const closed = (row: MaintenanceTicket) =>
  ['closed', 'cancelled'].includes(row.status);
export function MaintenancePanel({
  workspace,
  view = 'home',
  onNavigate,
  onOffice,
}: {
  workspace: Workspace;
  view?: string;
  onNavigate: (view: string) => void;
  onOffice?: () => void;
}) {
  const principal = workspace.account.role === 'principal',
    support = workspace.account.role === 'support',
    today = workspace.date;
  const [data, setData] = useState<MaintenanceView>(),
    [school, setSchool] = useState(workspace.schools[0]?.id ?? ''),
    [target, setTarget] = useState(workspace.schools[0]?.id ?? ''),
    [search, setSearch] = useState(''),
    [filterState, setFilterState] = useState({ view, status: 'all' }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<MaintenanceView>('maintenance', undefined, controller.signal)
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
  }, [reload]);
  async function save(
    event: SubmitEvent<HTMLFormElement>,
    action: string,
    row?: MaintenanceTicket,
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('maintenance', {
        ...values,
        action,
        ...(row
          ? { id: row.id, schoolId: row.schoolId, version: row.version }
          : {}),
      });
      setData(await request<MaintenanceView>('maintenance'));
      form.reset();
      if (action === 'create')
        setTarget(school || workspace.schools[0]?.id || '');
      setMessage(
        action === 'escalate'
          ? 'Education-office request created. Follow it in Officer coordination.'
          : action === 'verify'
            ? 'Principal verification saved.'
            : action === 'progress'
              ? 'Work report saved.'
              : action === 'create'
                ? 'Maintenance ticket raised.'
                : 'Maintenance update saved.',
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const tickets =
      data?.tickets.filter(
        (row) =>
          (!school || row.schoolId === school) &&
          `${row.title} ${row.location} ${row.category} ${row.reporter} ${row.assignee ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ) ?? [],
    active = tickets.filter((row) => !closed(row)),
    mine = active.filter((row) => row.assigneeId === workspace.account.id);
  const filter = filterState.view === view ? filterState.status : 'all';
  const base = tickets.filter((row) =>
    view === 'verification'
      ? row.status === 'reported'
      : view === 'history'
        ? closed(row)
        : view === 'reported'
          ? row.reporterId === workspace.account.id
          : view === 'work'
            ? !closed(row) &&
              (principal || row.assigneeId === workspace.account.id)
            : false,
  );
  const rows = base
    .filter(
      (row) =>
        filter === 'all' ||
        (filter === 'overdue'
          ? !closed(row) && !!row.due && row.due < today
          : row.status === filter),
    )
    .sort(
      (a, b) =>
        ({ urgent: 0, high: 1, normal: 2 })[a.priority] -
          { urgent: 0, high: 1, normal: 2 }[b.priority] ||
        (a.due ?? '9999').localeCompare(b.due ?? '9999'),
    );
  const go = (id: string) => {
    setFilterState({ view: id, status: 'all' });
    setMessage('');
    onNavigate(id);
  };
  const urgency = (value = 'normal') => (
    <label>
      Ticket urgency
      <select name="priority" defaultValue={value}>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
    </label>
  );
  const heading =
    view === 'home'
      ? 'School care overview'
      : view === 'work'
        ? principal
          ? 'All active maintenance work'
          : 'My assigned maintenance work'
        : view === 'reported'
          ? 'Reported school issues'
          : view === 'verification'
            ? 'Completion reports to verify'
            : 'Maintenance history';
  return (
    <section className="erp-maintenance">
      {!support && (
        <nav className="erp-section-tabs" aria-label="Maintenance sections">
          {[
            ['home', 'School care overview'],
            ...(principal
              ? [
                  ['work', 'All active work'],
                  ['verification', 'Verify completion'],
                ]
              : []),
            ['reported', 'My reported issues'],
            ['history', 'Maintenance history'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => go(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="erp-portal-section-heading">
        <div>
          <h3>{heading}</h3>
          <p>Current maintenance work and school readiness · {today}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh maintenance
        </button>
      </div>
      <div className="erp-maintenance-filters">
        <label>
          Maintenance school
          <select
            value={school}
            onChange={(event) => {
              setSchool(event.target.value);
              if (event.target.value) setTarget(event.target.value);
              setMessage('');
            }}
          >
            <option value="">All assigned schools</option>
            {workspace.schools.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Find maintenance work
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Issue, location, category or staff"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data ? (
        <output>Loading school maintenance…</output>
      ) : (
        <>
          {view === 'home' && (
            <>
              <div className="erp-portal-metrics">
                <div>
                  <strong>
                    {principal
                      ? active.length
                      : support
                        ? mine.length
                        : active.filter(
                            (row) => row.reporterId === workspace.account.id,
                          ).length}
                  </strong>
                  <span>
                    {principal
                      ? 'Open maintenance tickets'
                      : support
                        ? 'My assigned open jobs'
                        : 'My open reported issues'}
                  </span>
                </div>
                <div>
                  <strong>
                    {active.filter((row) => row.priority === 'urgent').length}
                  </strong>
                  <span>Urgent open issues in your view</span>
                </div>
                <div>
                  <strong>
                    {active.filter((row) => row.due && row.due < today).length}
                  </strong>
                  <span>Overdue jobs in your view</span>
                </div>
                <div>
                  <strong>
                    {active.filter((row) => row.status === 'reported').length}
                  </strong>
                  <span>Awaiting principal verification</span>
                </div>
              </div>
              <div className="erp-principal-grid">
                <section className="erp-principal-box">
                  <h3>Work to follow up</h3>
                  <p>
                    {active.filter((row) => row.status === 'blocked').length}{' '}
                    blocked ·{' '}
                    {active.filter((row) => row.status === 'open').length}{' '}
                    awaiting assignment ·{' '}
                    {active.filter((row) => row.requestId).length} with an
                    education-office request.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      go(principal || support ? 'work' : 'reported')
                    }
                  >
                    Open{' '}
                    {principal
                      ? 'active school work'
                      : support
                        ? 'my assigned jobs'
                        : 'my reported issues'}
                  </button>
                  <button type="button" onClick={() => go('reported')}>
                    Raise a school issue
                  </button>
                  {principal && (
                    <button type="button" onClick={() => go('verification')}>
                      Verify staff completion reports
                    </button>
                  )}
                </section>
                <section className="erp-principal-box">
                  <h3>School readiness by category</h3>
                  {[
                    'cleaning',
                    'water',
                    'electrical',
                    'furniture',
                    'grounds',
                    'safety',
                    'general',
                  ].map((category) => (
                    <p key={category}>
                      {category}:{' '}
                      {active.filter((row) => row.category === category).length}{' '}
                      open
                    </p>
                  ))}
                  <p>
                    Counts reflect reported tickets, not a completed safety
                    inspection or a daily checklist.
                  </p>
                </section>
              </div>
              <p>
                Work is complete when the principal verifies the staff report.
                General staff tasks and school inventory remain in their
                existing sections.
              </p>
            </>
          )}
          {view === 'reported' && (
            <details className="erp-operations-create">
              <summary>Raise maintenance ticket</summary>
              <form
                className="erp-portal-form"
                onSubmit={(event) => void save(event, 'create')}
              >
                <label>
                  Ticket school
                  <select
                    name="schoolId"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                  >
                    {!workspace.schools.length && (
                      <option value="">No assigned school</option>
                    )}
                    {workspace.schools.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ticket title
                  <input name="title" required maxLength={120} />
                </label>
                <label>
                  Maintenance category
                  <select name="category">
                    <option value="general">General</option>
                    <option value="cleaning">Cleaning / sanitation</option>
                    <option value="water">Water / washrooms</option>
                    <option value="electrical">Electrical</option>
                    <option value="furniture">Furniture</option>
                    <option value="grounds">Grounds / building</option>
                    <option value="safety">Safety concern</option>
                  </select>
                </label>
                <label>
                  Issue location
                  <input
                    name="location"
                    required
                    maxLength={120}
                    placeholder="Room, floor or facility"
                  />
                </label>
                {urgency()}
                <label>
                  Issue details
                  <textarea name="note" required maxLength={2000} />
                </label>
                <button className="erp-primary" disabled={busy || !target}>
                  Submit maintenance ticket
                </button>
              </form>
            </details>
          )}
          {view !== 'home' && (
            <>
              <label>
                Maintenance status filter
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilterState({ view, status: event.target.value })
                  }
                >
                  <option value="all">All in this section</option>
                  <option value="overdue">Overdue only</option>
                  {[
                    'open',
                    'assigned',
                    'in-progress',
                    'blocked',
                    'reported',
                    'closed',
                    'cancelled',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <RecordPreview
                key={`${view}:0`}
                className="erp-portal-records"
                label="Repair cases"
              >
                {rows.map((row) => (
                  <article
                    className="erp-portal-record"
                    key={`${row.id}:${row.version}`}
                  >
                    <header>
                      <div>
                        <span className="erp-eyebrow">
                          {
                            workspace.schools.find((s) => s.id === row.schoolId)
                              ?.name
                          }
                        </span>
                        <h3>{row.title}</h3>
                      </div>
                      <span className={`erp-status erp-${row.status}`}>
                        {row.status}
                      </span>
                    </header>
                    <p>
                      {row.category} · {row.location} · {row.priority} urgency
                    </p>
                    <p>{row.details}</p>
                    <p>
                      Reported by {row.reporter} · Assigned to{' '}
                      {row.assignee ?? 'Not assigned'}
                      {row.due ? ` · Due ${row.due}` : ''}
                      {!closed(row) && row.due && row.due < today
                        ? ' · Overdue'
                        : ''}
                    </p>
                    {row.progress && (
                      <blockquote>
                        <strong>Latest staff work report</strong>
                        {row.progress}
                      </blockquote>
                    )}
                    {row.verification && (
                      <blockquote>
                        <strong>Principal instructions / verification</strong>
                        {row.verification}
                      </blockquote>
                    )}
                    {row.requestId && (
                      <p>
                        Education-office request:{' '}
                        {row.officeStatus ?? 'submitted'}
                        {principal && (
                          <button type="button" onClick={onOffice}>
                            Open officer coordination
                          </button>
                        )}
                      </p>
                    )}
                    <small>
                      {new Date(row.at).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}{' '}
                      · Version {row.version}
                    </small>
                    {principal && !closed(row) && (
                      <details>
                        <summary>Assign or reassign support work</summary>
                        <form
                          className="erp-portal-form"
                          onSubmit={(event) => void save(event, 'assign', row)}
                        >
                          <label>
                            Assigned support staff
                            <select
                              name="assigneeId"
                              required
                              defaultValue={row.assigneeId ?? ''}
                            >
                              <option value="" disabled>
                                Choose support staff
                              </option>
                              {data.staff
                                .filter(
                                  (staff) => staff.schoolId === row.schoolId,
                                )
                                .map((staff) => (
                                  <option key={staff.id} value={staff.id}>
                                    {staff.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Work deadline
                            <input
                              name="due"
                              type="date"
                              required
                              min={today}
                              defaultValue={
                                row.due && row.due >= today ? row.due : today
                              }
                            />
                          </label>
                          {urgency(row.priority)}
                          <label>
                            Assignment instructions
                            <textarea name="note" required maxLength={2000} />
                          </label>
                          <button disabled={busy}>
                            Save maintenance assignment
                          </button>
                        </form>
                      </details>
                    )}
                    {support &&
                      row.assigneeId === workspace.account.id &&
                      ['assigned', 'in-progress', 'blocked'].includes(
                        row.status,
                      ) && (
                        <details>
                          <summary>Update my work</summary>
                          <form
                            onSubmit={(event) =>
                              void save(event, 'progress', row)
                            }
                          >
                            <label>
                              Work progress status
                              <select name="status">
                                <option value="in-progress">In progress</option>
                                <option value="blocked">
                                  Blocked / assistance needed
                                </option>
                                <option value="reported">
                                  Report work completed
                                </option>
                              </select>
                            </label>
                            <label>
                              Work progress report
                              <textarea name="note" required maxLength={2000} />
                            </label>
                            <button disabled={busy}>
                              Save maintenance progress
                            </button>
                          </form>
                        </details>
                      )}
                    {principal && row.status === 'reported' && (
                      <details>
                        <summary>Verify completed work</summary>
                        <form
                          onSubmit={(event) => void save(event, 'verify', row)}
                        >
                          <label>
                            Completion decision
                            <select name="status">
                              <option value="closed">Verify and close</option>
                              <option value="in-progress">
                                Return for more work
                              </option>
                            </select>
                          </label>
                          <label>
                            Completion verification note
                            <textarea name="note" required maxLength={2000} />
                          </label>
                          <button disabled={busy}>
                            Save maintenance verification
                          </button>
                        </form>
                      </details>
                    )}
                    {principal && !closed(row) && !row.requestId && (
                      <details>
                        <summary>Escalate to education office</summary>
                        <form
                          onSubmit={(event) =>
                            void save(event, 'escalate', row)
                          }
                        >
                          <label>
                            Escalation reason
                            <textarea name="note" required maxLength={2000} />
                          </label>
                          <button disabled={busy}>
                            Create education-office request
                          </button>
                        </form>
                      </details>
                    )}
                    {principal && (
                      <details>
                        <summary>
                          {closed(row)
                            ? 'Reopen maintenance ticket'
                            : 'Cancel maintenance ticket'}
                        </summary>
                        <form
                          onSubmit={(event) =>
                            void save(
                              event,
                              closed(row) ? 'reopen' : 'cancel',
                              row,
                            )
                          }
                        >
                          <label>
                            {closed(row)
                              ? 'Reopening reason'
                              : 'Cancellation reason'}
                            <textarea name="note" required maxLength={2000} />
                          </label>
                          <button disabled={busy}>
                            {closed(row) ? 'Reopen ticket' : 'Cancel ticket'}
                          </button>
                        </form>
                      </details>
                    )}
                    <details>
                      <summary>Maintenance action history</summary>
                      {data.history
                        .filter((item) => item.targetId === row.id)
                        .map((item) => {
                          const detail = JSON.parse(item.note) as {
                            note: string;
                            before: { status: string } | null;
                            after: { status: string };
                          };
                          return (
                            <p key={item.id}>
                              {item.actor} ·{' '}
                              {new Date(item.at).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                              })}
                              <br />
                              {detail.before?.status ?? 'new'} →{' '}
                              {detail.after.status}
                              <br />
                              {detail.note}
                            </p>
                          );
                        })}
                    </details>
                  </article>
                ))}
              </RecordPreview>
              {!rows.length && (
                <p>No maintenance tickets match this section and filter.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
