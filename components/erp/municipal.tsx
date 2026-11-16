'use client';
import { readActivityNote } from '@/lib/erp/activity-note';
import { RecordPreview } from './record-preview';

import { useState, type SubmitEvent } from 'react';
import { attendanceRate, type Workspace } from '@/lib/erp/model';
import type { OversightView, SchoolSummary } from '@/lib/erp/oversight';
import type { MunicipalPriority, MunicipalView } from '@/lib/erp/municipal';
import { errorMessage, request } from './client';
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    value / 100,
  );
const open = (row: MunicipalPriority) => row.status !== 'closed';
export function MunicipalDashboard({
  data,
  schools,
  view,
  today,
  onNavigate,
  onSchool,
  onReports,
}: {
  data: OversightView;
  schools: SchoolSummary[];
  view: string;
  today: string;
  onNavigate: (view: string) => void;
  onSchool: (id: string) => void;
  onReports?: () => void;
}) {
  const [sort, setSort] = useState('name');
  const ids = new Set(schools.map((row) => row.id)),
    priorities = data.municipal.priorities.filter((row) =>
      ids.has(row.schoolId),
    ),
    escalations = data.records.filter(
      (row) => ids.has(row.schoolId) && row.status === 'escalated',
    );
  const present = schools.reduce((sum, row) => sum + row.attendance.present, 0),
    marks = schools.reduce((sum, row) => sum + row.attendance.total, 0),
    expected = schools.reduce((sum, row) => sum + row.attendance.expected, 0),
    received = schools.reduce(
      (sum, row) => sum + row.attendance.submitted + row.attendance.reviewed,
      0,
    ),
    published = schools.reduce((sum, row) => sum + row.published, 0);
  const ordered = [...schools].sort((a, b) => {
    if (sort === 'coverage')
      return (
        (a.attendance.expected
          ? (a.attendance.submitted + a.attendance.reviewed) /
            a.attendance.expected
          : 2) -
        (b.attendance.expected
          ? (b.attendance.submitted + b.attendance.reviewed) /
            b.attendance.expected
          : 2)
      );
    if (sort === 'attendance')
      return (
        (a.attendance.total ? a.attendance.present / a.attendance.total : 2) -
        (b.attendance.total ? b.attendance.present / b.attendance.total : 2)
      );
    if (sort === 'academic') return (a.average ?? 101) - (b.average ?? 101);
    if (sort === 'stock') return b.zeroStock - a.zeroStock;
    return a.name.localeCompare(b.name);
  });
  return (
    <div className="erp-municipal">
      {view === 'municipal' && (
        <>
          <h3>Municipal education overview</h3>
          <p>
            Reporting date {data.date}. Priorities, escalations, inventory and
            staff accounts show their current state.
          </p>
          <div className="erp-portal-metrics">
            <div>
              <strong>{schools.length}</strong>
              <span>Schools in this view</span>
            </div>
            <div>
              <strong>
                {schools.reduce((sum, row) => sum + row.enrolled, 0)}
              </strong>
              <span>Enrolled learners</span>
            </div>
            <div>
              <strong>
                {marks ? `${((100 * present) / marks).toFixed(1)}%` : '—'}
              </strong>
              <span>
                {present}/{marks} reported attendance marks
              </span>
            </div>
            <div>
              <strong>
                {received}/{expected}
              </strong>
              <span>Registers received</span>
            </div>
          </div>
          <div className="erp-principal-grid">
            <section className="erp-principal-box">
              <h3>Decisions & follow-ups</h3>
              <button type="button" onClick={() => onNavigate('escalations')}>
                <span>Escalated requests awaiting decision</span>
                <strong>{escalations.length}</strong>
              </button>
              <button type="button" onClick={() => onNavigate('priorities')}>
                <span>Officer completion reports to verify</span>
                <strong>
                  {priorities.filter((row) => row.status === 'reported').length}
                </strong>
              </button>
              <button type="button" onClick={() => onNavigate('priorities')}>
                <span>Overdue municipal priorities</span>
                <strong>
                  {
                    priorities.filter((row) => open(row) && row.due < today)
                      .length
                  }
                </strong>
              </button>
              <button type="button" onClick={() => onNavigate('circular')}>
                <span>Outstanding school circulars</span>
                <strong>
                  {
                    data.records.filter(
                      (row) =>
                        ids.has(row.schoolId) &&
                        row.kind === 'circular' &&
                        row.status !== 'closed',
                    ).length
                  }
                </strong>
              </button>
              <button type="button" onClick={onReports}>
                <span>Schools with missing or returned registers</span>
                <strong>
                  {
                    schools.filter(
                      (row) =>
                        row.attendance.missing + row.attendance.returned > 0,
                    ).length
                  }
                </strong>
              </button>
            </section>
            <section className="erp-principal-box">
              <h3>Learning & resources</h3>
              <p>
                {published} published results across{' '}
                {schools.reduce((sum, row) => sum + row.assessed, 0)}{' '}
                represented learners.
              </p>
              <p>
                Average recorded result:{' '}
                <strong>
                  {published
                    ? `${(schools.reduce((sum, row) => sum + (row.average ?? 0) * row.published, 0) / published).toFixed(1)}%`
                    : '—'}
                </strong>
                . Each result contributes equally across subjects and exams.
              </p>
              <p>
                Recorded grant allocations{' '}
                {money(schools.reduce((sum, row) => sum + row.grants, 0))};
                expenses{' '}
                {money(schools.reduce((sum, row) => sum + row.expenses, 0))}.
              </p>
              <p>
                {schools.reduce((sum, row) => sum + row.zeroStock, 0)} inventory
                item types at zero stock.
              </p>
              <button type="button" onClick={() => onNavigate('comparison')}>
                Compare school coverage
              </button>
              <button type="button" onClick={() => onNavigate('resources')}>
                Review grants & infrastructure
              </button>
            </section>
          </div>
          <h3>High-priority school follow-ups</h3>
          {priorities
            .filter((row) => open(row) && row.priority === 'high')
            .slice(0, 10)
            .map((row) => (
              <article className="erp-portal-record" key={row.id}>
                <h3>{row.title}</h3>
                <p>
                  {schools.find((s) => s.id === row.schoolId)?.name} ·{' '}
                  {row.officer} · Due {row.due} · {row.status}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onSchool(row.schoolId);
                    onNavigate('priorities');
                  }}
                >
                  Open municipal priorities
                </button>
              </article>
            ))}
          {!priorities.some((row) => open(row) && row.priority === 'high') && (
            <p>No open high-priority municipal assignments in this view.</p>
          )}
          <div className="erp-portal-next">
            <button type="button" onClick={() => onNavigate('priorities')}>
              Assign a municipal priority
            </button>
            <button type="button" onClick={() => onNavigate('circular')}>
              Issue school circular
            </button>
          </div>
        </>
      )}
      {view === 'comparison' && (
        <>
          <h3>School comparison</h3>
          <p>
            Compare coverage and follow-up needs. Different exams, incomplete
            registers and missing records affect comparability; this is not a
            school ranking.
          </p>
          <label>
            Order schools by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="name">School name</option>
              <option value="coverage">Lowest register coverage first</option>
              <option value="attendance">
                Lowest reported attendance first
              </option>
              <option value="academic">
                Lowest recorded result average first
              </option>
              <option value="stock">Most zero-stock item types first</option>
            </select>
          </label>
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Enrolled</th>
                  <th>Teacher / staff accounts</th>
                  <th>Attendance</th>
                  <th>Registers received</th>
                  <th>Published academics</th>
                  <th>Unspent allocation</th>
                  <th>Zero-stock types</th>
                  <th>Escalations</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.enrolled}</td>
                    <td>
                      {row.teachers}/{row.staff}
                    </td>
                    <td>
                      {attendanceRate(row.attendance)}
                      <br />
                      <small>
                        {row.attendance.present}/{row.attendance.total} marks
                      </small>
                    </td>
                    <td>
                      {row.attendance.submitted + row.attendance.reviewed}/
                      {row.attendance.expected}
                    </td>
                    <td>
                      {row.average === null
                        ? '—'
                        : `${row.average.toFixed(1)}%`}
                      <br />
                      <small>
                        {row.published} results · {row.assessed} learners
                      </small>
                    </td>
                    <td>{money(row.grants - row.expenses)}</td>
                    <td>{row.zeroStock}</td>
                    <td>
                      {
                        escalations.filter((item) => item.schoolId === row.id)
                          .length
                      }
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          onSchool(row.id);
                          onNavigate('schools');
                        }}
                      >
                        Open school profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <a
        className="erp-button"
        href={`/api/erp/oversight?date=${data.date}&format=csv`}
      >
        Export all schools summary CSV
      </a>
      <p className="erp-directory-help">
        The export includes all schools in your municipal scope. Attendance uses
        reported marks; academic averages use published results. Staff account
        counts are not sanctioned positions, and grant allocations are not
        verified bank balances.
      </p>
    </div>
  );
}
export function MunicipalPriorities({
  workspace,
  data,
  schoolId,
  onSaved,
}: {
  workspace: Workspace;
  data: OversightView;
  schoolId: string;
  onSaved: (value: MunicipalView) => void;
}) {
  const commissioner = workspace.account.role === 'commissioner',
    officer = workspace.account.role === 'officer';
  const [target, setTarget] = useState(
      schoolId || workspace.schools[0]?.id || '',
    ),
    [filter, setFilter] = useState('open'),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const local = data.municipal;
  const priorities = local.priorities.filter(
    (row) =>
      (!schoolId || row.schoolId === schoolId) &&
      (filter === 'all' ||
        (filter === 'open'
          ? open(row)
          : filter === 'overdue'
            ? open(row) && row.due < workspace.date
            : row.status === filter)),
  );
  async function save(
    event: SubmitEvent<HTMLFormElement>,
    action: string,
    row?: MunicipalPriority,
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      payload = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('municipal', {
        ...payload,
        action,
        ...(row
          ? { id: row.id, schoolId: row.schoolId, version: row.version }
          : {}),
      });
      const updated = await request<MunicipalView>('municipal');
      onSaved(updated);
      form.reset();
      if (action === 'assign')
        setTarget(schoolId || workspace.schools[0]?.id || '');
      setMessage('Municipal priority saved.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const staffSelect = (school: string) => (
    <label>
      Responsible education officer
      <select name="officerId" required defaultValue="">
        <option value="" disabled>
          Choose assigned officer
        </option>
        {local.officers
          .filter((row) => row.schoolId === school)
          .map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <div className="erp-municipal">
      <h3>Municipal priorities</h3>
      <p>
        {commissioner
          ? 'Assign a school priority to its education officer, then verify the officer’s completion report.'
          : officer
            ? 'Report progress on priorities assigned to you. The Commissioner verifies completion.'
            : 'Read the priorities assigned to your school’s supervising officer.'}
      </p>
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {commissioner && (
        <details className="erp-operations-create">
          <summary>Assign school priority</summary>
          <form
            className="erp-portal-form"
            onSubmit={(event) => void save(event, 'assign')}
          >
            <label>
              Priority school
              <select
                name="schoolId"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                required
              >
                {workspace.schools.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            {staffSelect(target)}
            <label>
              Priority title
              <input name="title" required maxLength={120} />
            </label>
            <label>
              Priority category
              <select name="category">
                <option value="governance">Governance</option>
                <option value="academics">Academics</option>
                <option value="staffing">Staffing</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="finance">Finance follow-up</option>
              </select>
            </label>
            <label>
              Urgency
              <select name="priority">
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Priority deadline
              <input
                name="due"
                type="date"
                min={workspace.date}
                required
                defaultValue={workspace.date}
              />
            </label>
            <label>
              Commissioner instructions
              <textarea name="note" required maxLength={2000} />
            </label>
            {!local.officers.some((row) => row.schoolId === target) && (
              <p>
                No education officer is assigned to this school. An
                administrator must assign one before this priority can be
                created.
              </p>
            )}
            <button
              disabled={
                busy || !local.officers.some((row) => row.schoolId === target)
              }
              className="erp-primary"
            >
              Save municipal assignment
            </button>
          </form>
        </details>
      )}
      <label>
        Priority filter
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="open">Open priorities</option>
          <option value="all">All priorities</option>
          <option value="overdue">Overdue priorities</option>
          <option value="reported">Completion reports to verify</option>
          <option value="closed">Closed priorities</option>
        </select>
      </label>
      <RecordPreview
        className="erp-portal-records"
        label="Municipal priorities"
      >
        {priorities.map((row) => (
          <article
            className="erp-portal-record"
            key={`${row.id}:${row.version}`}
          >
            <header>
              <div>
                <span className="erp-eyebrow">
                  {workspace.schools.find((s) => s.id === row.schoolId)?.name}
                </span>
                <h3>{row.title}</h3>
              </div>
              <span className={`erp-status erp-${row.status}`}>
                {row.status}
              </span>
            </header>
            <p>
              {row.priority} priority · {row.category} · Due {row.due}
              {row.status !== 'closed' && row.due < workspace.date
                ? ' · Overdue'
                : ''}
            </p>
            <p>Responsible officer: {row.officer}</p>
            <p>{row.instructions}</p>
            {row.progress && (
              <blockquote>
                <strong>Officer progress / completion report</strong>
                {row.progress}
              </blockquote>
            )}
            {row.verification && (
              <blockquote>
                <strong>Commissioner remarks</strong>
                {row.verification}
              </blockquote>
            )}
            <small>
              Assigned by {row.author} · Version {row.version}
            </small>
            {officer && ['assigned', 'in-progress'].includes(row.status) && (
              <details>
                <summary>Update assigned priority</summary>
                <form onSubmit={(event) => void save(event, 'progress', row)}>
                  <label>
                    Progress status
                    <select name="status">
                      <option value="in-progress">In progress</option>
                      <option value="reported">
                        Report completed work for verification
                      </option>
                    </select>
                  </label>
                  <label>
                    Officer progress report
                    <textarea name="note" required maxLength={2000} />
                  </label>
                  <button disabled={busy}>Save officer progress</button>
                </form>
              </details>
            )}
            {commissioner && row.status === 'reported' && (
              <details>
                <summary>Verify officer report</summary>
                <form onSubmit={(event) => void save(event, 'verify', row)}>
                  <label>
                    Verification outcome
                    <select name="status">
                      <option value="closed">Verify and close</option>
                      <option value="in-progress">Return for more work</option>
                    </select>
                  </label>
                  <label>
                    Verification remarks
                    <textarea name="note" required maxLength={2000} />
                  </label>
                  <button disabled={busy}>Save municipal verification</button>
                </form>
              </details>
            )}
            {commissioner && row.status !== 'closed' && (
              <details>
                <summary>Reassign responsible officer</summary>
                <form onSubmit={(event) => void save(event, 'reassign', row)}>
                  {staffSelect(row.schoolId)}
                  <label>
                    Reassignment reason
                    <textarea name="note" required maxLength={2000} />
                  </label>
                  <button disabled={busy}>Save officer reassignment</button>
                </form>
              </details>
            )}
            <details>
              <summary>Municipal action history</summary>
              {local.history
                .filter((item) => item.targetId === row.id)
                .map((item) => {
                  const detail = readActivityNote(item.note);
                  return (
                    <p key={item.id}>
                      {item.actor} ·{' '}
                      {new Date(item.at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                      <br />
                      {detail.after && (
                        <>
                          {detail.before ?? 'new'} → {detail.after}
                          <br />
                        </>
                      )}
                      {detail.note}
                    </p>
                  );
                })}
            </details>
          </article>
        ))}
      </RecordPreview>
      {!priorities.length && (
        <p>No municipal priorities match this school and filter.</p>
      )}
    </div>
  );
}
