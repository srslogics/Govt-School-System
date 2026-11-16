'use client';
import { readActivityNote } from '@/lib/erp/activity-note';
import { RecordPreview } from './record-preview';

import { useEffect, useState, type SubmitEvent } from 'react';
import { attendanceRate, type Workspace } from '@/lib/erp/model';
import type { EducationRecord, OversightView } from '@/lib/erp/oversight';
import { MunicipalDashboard, MunicipalPriorities } from './municipal';
import { request, errorMessage } from './client';
import { oversightLinks } from './navigation';

const currency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    amount / 100,
  );
const names = {
  inspection: 'Inspections',
  request: 'School requests',
  circular: 'Circulars & compliance',
};
export function OversightPanel({
  workspace,
  date,
  onOpenReports,
  activeView,
  onViewChange,
  hideNavigation = false,
}: {
  workspace: Workspace;
  date: string;
  onOpenReports?: () => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
  hideNavigation?: boolean;
}) {
  const principal = workspace.account.role === 'principal',
    commissioner = workspace.account.role === 'commissioner';
  const [data, setData] = useState<OversightView>(),
    [localView, setLocalView] = useState(
      principal ? 'request' : commissioner ? 'municipal' : 'overview',
    ),
    [school, setSchool] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const view = activeView ?? localView;
  useEffect(() => {
    const controller = new AbortController();
    request<OversightView>(
      `oversight?date=${date}`,
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
    setStatus('all');
    setMessage('');
  }
  async function save(
    event: SubmitEvent<HTMLFormElement>,
    action: string,
    record?: EducationRecord,
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      payload = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('oversight', {
        ...payload,
        action,
        ...(record
          ? {
              id: record.id,
              schoolId: record.schoolId,
              version: record.version,
            }
          : {}),
        ...(payload.broadcast === 'all'
          ? { schoolIds: workspace.schools.map((row) => row.id) }
          : {}),
      });
      const result = await request<OversightView>(`oversight?date=${date}`);
      setData(result);
      form.reset();
      setMessage('Saved. The school and supervising team can see the update.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const navigate = (id: string) => {
    setLocalView(id);
    onViewChange?.(id);
    setStatus('all');
    setMessage('');
  };
  const schools =
    data?.schools.filter(
      (row) =>
        (!school || row.id === school) &&
        `${row.name} ${row.code}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const ids = new Set(schools.map((row) => row.id)),
    records = data?.records.filter((row) => ids.has(row.schoolId)) ?? [];
  const visible = records.filter(
    (row) =>
      row.kind === (view === 'escalations' ? 'request' : view) &&
      (view !== 'escalations' || row.status === 'escalated') &&
      (status === 'all' ||
        (status === 'open'
          ? !['closed', 'resolved', 'declined'].includes(row.status)
          : row.status === status)),
  );
  const pending = records.filter(
    (row) => !['closed', 'resolved', 'declined'].includes(row.status),
  );
  const schoolField = (
    <label>
      Target school
      <select
        name="schoolId"
        required
        defaultValue={school || workspace.schools[0]?.id || ''}
      >
        {workspace.schools.map((row) => (
          <option value={row.id} key={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
  const noteField = (label: string) => (
    <label>
      {label}
      <textarea name="note" required maxLength={2000} />
    </label>
  );
  const titleField = (label: string) => (
    <label>
      {label}
      <input name="title" required maxLength={120} />
    </label>
  );
  return (
    <section className="erp-card erp-oversight">
      <header className="erp-card-title">
        <div>
          <span className="erp-eyebrow">
            {principal
              ? 'SCHOOL & EDUCATION OFFICE'
              : 'ASSIGNED SCHOOL OVERSIGHT'}
          </span>
          <h2>
            {hideNavigation
              ? ({
                  municipal: 'Network summary',
                  overview: 'School reporting summary',
                  comparison: 'School comparison',
                  resources: 'Resources and expenditure',
                  inspection: 'Inspection register',
                  request: 'School request register',
                  circular: 'Circular register',
                  priorities: 'Priority register',
                  escalations: 'Escalated requests',
                }[view] ?? 'School oversight')
              : principal
                ? 'Officer coordination'
                : commissioner
                  ? 'Commissioner workspace'
                  : 'Education Officer workspace'}
          </h2>
          <p>School reporting, inspections, requests and compliance records.</p>
        </div>
        <button type="button" onClick={() => setReload(reload + 1)}>
          Refresh oversight
        </button>
      </header>
      {!hideNavigation && (
        <nav
          className="erp-section-tabs"
          aria-label="Education oversight sections"
        >
          {oversightLinks(workspace.account.role).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="erp-oversight-filters">
        <label>
          Assigned school
          <select
            value={school}
            onChange={(event) => setSchool(event.target.value)}
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
          Find school
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="School name or code"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data || data.date !== date ? (
        <output>Loading assigned school oversight…</output>
      ) : (
        <>
          {commissioner && ['municipal', 'comparison'].includes(view) && (
            <MunicipalDashboard
              embedded={hideNavigation}
              data={data}
              schools={schools}
              view={view}
              today={workspace.date}
              onNavigate={navigate}
              onSchool={setSchool}
              onReports={onOpenReports}
            />
          )}
          {view === 'priorities' && (
            <MunicipalPriorities
              key={school}
              workspace={workspace}
              data={data}
              schoolId={school}
              onSaved={(municipal) =>
                setData((current) =>
                  current ? { ...current, municipal } : current,
                )
              }
            />
          )}
          {view === 'overview' && (
            <>
              <h3>Schools needing attention</h3>
              <div className="erp-portal-metrics">
                <div>
                  <strong>{schools.length}</strong>
                  <span>Assigned schools in this view</span>
                </div>
                <div>
                  <strong>
                    {
                      schools.filter(
                        (row) =>
                          row.attendance.missing + row.attendance.returned > 0,
                      ).length
                    }
                  </strong>
                  <span>Schools with missing / returned registers</span>
                </div>
                <div>
                  <strong>{pending.length}</strong>
                  <span>Open oversight records</span>
                </div>
              </div>
              <div className="erp-principal-grid">
                <section className="erp-principal-box">
                  <h3>Follow-up queue</h3>
                  {[
                    ['inspection', 'Open inspections & follow-ups'],
                    ['request', 'School requests to follow up'],
                    ['circular', 'Circular compliance outstanding'],
                  ].map(([kind, label]) => (
                    <button
                      type="button"
                      key={kind}
                      onClick={() => {
                        navigate(kind);
                        setStatus('open');
                      }}
                    >
                      <span>{label}</span>
                      <strong>
                        {pending.filter((row) => row.kind === kind).length}
                      </strong>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      navigate('request');
                      setStatus('escalated');
                    }}
                  >
                    <span>Escalated for Commissioner decision</span>
                    <strong>
                      {
                        records.filter((row) => row.status === 'escalated')
                          .length
                      }
                    </strong>
                  </button>
                </section>
                <section className="erp-principal-box">
                  <h3>School signals · {date}</h3>
                  <p>
                    {schools.reduce((sum, row) => sum + row.enrolled, 0)}{' '}
                    enrolled learners ·{' '}
                    {schools.reduce((sum, row) => sum + row.teachers, 0)}{' '}
                    teacher assignments across schools
                  </p>
                  <p>
                    {
                      schools.filter(
                        (row) => row.average !== null && row.average < 40,
                      ).length
                    }{' '}
                    schools with published result averages below 40%. Review
                    exam coverage before drawing conclusions.
                  </p>
                  <p>
                    {
                      pending.filter(
                        (row) => row.data.due && row.data.due < workspace.date,
                      ).length
                    }{' '}
                    open records past their deadline.
                  </p>
                  <button type="button" onClick={onOpenReports}>
                    Open full attendance reports
                  </button>
                  <button type="button" onClick={() => navigate('schools')}>
                    Explore school profiles
                  </button>
                </section>
              </div>
              <div className="erp-scroll">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Attendance</th>
                      <th>Register coverage</th>
                      <th>Open follow-ups</th>
                      <th>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>
                          {attendanceRate(row.attendance)}
                          <br />
                          <small>
                            {row.attendance.present}/{row.attendance.total}{' '}
                            reported marks
                          </small>
                        </td>
                        <td>
                          {row.attendance.submitted + row.attendance.reviewed}/
                          {row.attendance.expected} received ·{' '}
                          {row.attendance.missing} missing
                        </td>
                        <td>
                          {
                            pending.filter((item) => item.schoolId === row.id)
                              .length
                          }
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSchool(row.id);
                              navigate('schools');
                            }}
                          >
                            View school profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="erp-directory-help">
                Attendance excludes missing/returned registers. Open workflows
                and inventory are current; learner counts, attendance, published
                academics and grant totals use the selected date. Assigned
                accounts are not a sanctioned staffing roster.
              </p>
            </>
          )}
          {view === 'schools' && (
            <>
              <h3>School profiles</h3>
              <p>
                Published results through {date}; percentages give equal weight
                to each recorded result across exams and subjects. These are
                coverage indicators, not school rankings.
              </p>
              {schools.map((row) => (
                <article className="erp-portal-record" key={row.id}>
                  <span className="erp-eyebrow">{row.code}</span>
                  <h3>{row.name}</h3>
                  <div className="erp-portal-metrics">
                    <div>
                      <strong>{row.enrolled}</strong>
                      <span>Enrolled learners</span>
                    </div>
                    <div>
                      <strong>
                        {row.teachers}/{row.staff}
                      </strong>
                      <span>Teacher / staff accounts</span>
                    </div>
                    <div>
                      <strong>
                        {row.average === null
                          ? '—'
                          : `${row.average.toFixed(1)}%`}
                      </strong>
                      <span>Published result average</span>
                    </div>
                  </div>
                  <p>
                    {row.assessed} learners represented in {row.published}{' '}
                    published results · {row.classes} effective classes.
                  </p>
                  <div className="erp-scroll">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th>Enrolment</th>
                          <th>Assigned teachers</th>
                          <th>Register status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.classes
                          .filter((item) => item.schoolId === row.id)
                          .map((item) => (
                            <tr key={item.id}>
                              <td>
                                {item.grade} · {item.section}
                              </td>
                              <td>{item.enrolled}</td>
                              <td>{item.teachers}</td>
                              <td>{item.status}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="erp-portal-next">
                    <button
                      type="button"
                      onClick={() => {
                        setSchool(row.id);
                        navigate('inspection');
                      }}
                    >
                      Plan a school inspection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSchool(row.id);
                        navigate('request');
                      }}
                    >
                      Review school requests
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
          {view === 'resources' && (
            <>
              <h3>Grants & infrastructure oversight</h3>
              <p>
                Grant allocations and expenses through {date}; inventory figures
                are current. Recorded grants are management entries, not
                verified bank balances or audited utilisation certificates.
              </p>
              <div className="erp-scroll">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Sanctioned grants</th>
                      <th>Recorded expenses</th>
                      <th>Unspent allocation</th>
                      <th>Inventory</th>
                      <th>Maintenance follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{currency(row.grants)}</td>
                        <td>{currency(row.expenses)}</td>
                        <td>{currency(row.grants - row.expenses)}</td>
                        <td>
                          {row.inventoryItems} item types · {row.zeroStock} at
                          zero stock
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSchool(row.id);
                              navigate('request');
                              setStatus('open');
                            }}
                          >
                            {
                              pending.filter(
                                (item) =>
                                  item.schoolId === row.id &&
                                  item.kind === 'request' &&
                                  item.data.category === 'maintenance',
                              ).length
                            }{' '}
                            open maintenance requests
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Inventory has no configured minimum-stock thresholds; zero stock
                is the available shortage signal. Principals submit staffing,
                funding and maintenance needs in School requests.
              </p>
            </>
          )}
          {['inspection', 'request', 'circular', 'escalations'].includes(
            view,
          ) && (
            <>
              <h3>
                {view === 'escalations'
                  ? 'Escalated decisions'
                  : names[view as keyof typeof names]}
              </h3>
              <p>
                These records show current progress across the school and
                supervising office. Every response or decision requires remarks.
              </p>
              {((view === 'request' && principal) ||
                (view !== 'request' &&
                  view !== 'escalations' &&
                  !principal)) && (
                <details
                  className="erp-operations-create"
                  key={`${view}:${school}`}
                >
                  <summary>
                    {view === 'inspection'
                      ? 'Plan inspection'
                      : view === 'request'
                        ? 'Submit school request'
                        : 'Issue circular'}
                  </summary>
                  <form
                    className="erp-portal-form"
                    onSubmit={(event) => void save(event, view)}
                  >
                    {schoolField}
                    {titleField(
                      view === 'inspection'
                        ? 'Visit purpose'
                        : view === 'request'
                          ? 'Request title'
                          : 'Circular title',
                    )}
                    {view === 'inspection' && (
                      <label>
                        Planned visit date
                        <input
                          name="visitDate"
                          type="date"
                          defaultValue={workspace.date}
                          required
                        />
                      </label>
                    )}
                    {view === 'circular' && (
                      <>
                        <label>
                          Compliance deadline
                          <input
                            name="due"
                            type="date"
                            min={workspace.date}
                            required
                            defaultValue={workspace.date}
                          />
                        </label>
                        <label>
                          Recipients
                          <select name="broadcast">
                            <option value="one">Selected school</option>
                            <option value="all">All my assigned schools</option>
                          </select>
                        </label>
                      </>
                    )}
                    {view === 'request' && (
                      <>
                        <label>
                          Request category
                          <select name="category">
                            <option value="general">General</option>
                            <option value="staffing">Staffing</option>
                            <option value="academics">Academics</option>
                            <option value="funding">Funding</option>
                            <option value="maintenance">
                              Maintenance / infrastructure
                            </option>
                          </select>
                        </label>
                        <label>
                          Priority
                          <select name="priority">
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                      </>
                    )}
                    {noteField(
                      view === 'inspection'
                        ? 'Inspection plan'
                        : view === 'request'
                          ? 'School request details'
                          : 'Circular instructions',
                    )}
                    <button disabled={busy} className="erp-primary">
                      {view === 'inspection'
                        ? 'Save planned inspection'
                        : view === 'request'
                          ? 'Send school request'
                          : 'Publish circular'}
                    </button>
                  </form>
                </details>
              )}
              {view !== 'escalations' && (
                <label>
                  Record filter
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="all">All records</option>
                    <option value="open">Open records</option>
                    {[
                      'planned',
                      'visited',
                      'responded',
                      'submitted',
                      'under-review',
                      'returned',
                      'escalated',
                      'issued',
                      'acknowledged',
                      'reported',
                      'closed',
                      'resolved',
                      'declined',
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <RecordPreview
                key={`${view}:0`}
                className="erp-portal-records"
                label="Officer records"
              >
                {visible.map((row) => (
                  <article
                    className="erp-portal-record"
                    key={`${row.id}:${row.version}`}
                  >
                    <header>
                      <div>
                        <span className="erp-eyebrow">
                          {
                            data.schools.find(
                              (item) => item.id === row.schoolId,
                            )?.name
                          }
                        </span>
                        <h3>{row.data.title}</h3>
                      </div>
                      <span className={`erp-status erp-${row.status}`}>
                        {row.status}
                      </span>
                    </header>
                    <p>{row.data.note}</p>
                    {Object.entries({
                      visitDate: 'Planned visit',
                      visitedOn: 'Visit recorded',
                      due: 'Deadline',
                      category: 'Category',
                      priority: 'Priority',
                      findings: 'Inspection findings',
                      requiredAction: 'Required action',
                      response: 'School action report',
                      review: 'Officer review',
                      decision: 'Request outcome remarks',
                      resubmission: 'School resubmission',
                      acknowledgement: 'Acknowledgement',
                      compliance: 'Compliance report',
                      verification: 'Verification remarks',
                    }).map(
                      ([field, label]) =>
                        row.data[field] && (
                          <p key={field}>
                            <strong>{label}: </strong>
                            {row.data[field]}
                          </p>
                        ),
                    )}
                    {row.status === 'escalated' && (
                      <p>
                        Awaiting Commissioner decision. Request dispositions do
                        not authorise spending or execute payments.
                      </p>
                    )}
                    <small>
                      Created by {row.author} · Last updated by{' '}
                      {row.data.updatedBy} · Version {row.version}
                    </small>
                    {!principal &&
                      row.kind === 'inspection' &&
                      row.status === 'planned' && (
                        <details>
                          <summary>Record visit findings</summary>
                          <form
                            className="erp-portal-form"
                            onSubmit={(event) =>
                              void save(event, 'findings', row)
                            }
                          >
                            <label>
                              Actual visit date
                              <input
                                name="visitedOn"
                                type="date"
                                max={workspace.date}
                                defaultValue={workspace.date}
                                required
                              />
                            </label>
                            <label>
                              Corrective action deadline
                              <input
                                name="due"
                                type="date"
                                required
                                defaultValue={workspace.date}
                              />
                            </label>
                            {noteField('Inspection findings')}
                            <label>
                              Corrective action
                              <textarea
                                name="requiredAction"
                                required
                                maxLength={2000}
                              />
                            </label>
                            <button disabled={busy}>
                              Save inspection findings
                            </button>
                          </form>
                        </details>
                      )}
                    {principal &&
                      row.kind === 'inspection' &&
                      row.status === 'visited' && (
                        <NoteAction
                          label="Report corrective action"
                          action="inspection-response"
                          noteLabel="School corrective-action report"
                          save={save}
                          row={row}
                          busy={busy}
                        />
                      )}
                    {!principal &&
                      row.kind === 'inspection' &&
                      row.status === 'responded' && (
                        <Decision
                          action="inspection-decision"
                          choices={[
                            ['closed', 'Verify and close'],
                            ['visited', 'Return for more action'],
                          ]}
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    {!principal &&
                      row.kind === 'request' &&
                      row.status === 'submitted' && (
                        <NoteAction
                          label="Record officer review"
                          action="review-request"
                          noteLabel="Officer review"
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    {!principal &&
                      row.kind === 'request' &&
                      (row.status === 'under-review' ||
                        (commissioner && row.status === 'escalated')) && (
                        <Decision
                          action="request-decision"
                          choices={[
                            ['resolved', 'Resolve request'],
                            ['returned', 'Return to school'],
                            ['declined', 'Decline request'],
                            ...(!commissioner
                              ? [['escalated', 'Escalate to Commissioner']]
                              : []),
                          ]}
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    {principal &&
                      row.kind === 'request' &&
                      row.status === 'returned' && (
                        <NoteAction
                          label="Resubmit school request"
                          action="resubmit-request"
                          noteLabel="Resubmission details"
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    {principal &&
                      row.kind === 'circular' &&
                      row.status === 'issued' && (
                        <NoteAction
                          label="Acknowledge circular"
                          action="acknowledge"
                          noteLabel="Acknowledgement note"
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    {principal &&
                      row.kind === 'circular' &&
                      row.status === 'acknowledged' && (
                        <NoteAction
                          label="Submit compliance report"
                          action="compliance"
                          noteLabel="Compliance report"
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    {!principal &&
                      row.kind === 'circular' &&
                      row.status === 'reported' && (
                        <Decision
                          action="verify-compliance"
                          choices={[
                            ['closed', 'Verify and close'],
                            ['acknowledged', 'Return for more details'],
                          ]}
                          row={row}
                          save={save}
                          busy={busy}
                        />
                      )}
                    <details>
                      <summary>Follow-up history</summary>
                      {data.history
                        .filter((item) => item.targetId === row.id)
                        .map((item) => {
                          const detail = readActivityNote(item.note);
                          return (
                            <p key={item.id}>
                              <strong>
                                {item.actor} ·{' '}
                                {new Date(item.at).toLocaleString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                })}
                              </strong>
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
              {!visible.length && (
                <p>No {view} records match this school and filter.</p>
              )}
            </>
          )}
          {!schools.length && <p>No assigned schools match this view.</p>}
        </>
      )}
    </section>
  );
}
type ActionProps = {
  row: EducationRecord;
  busy: boolean;
  save: (
    event: SubmitEvent<HTMLFormElement>,
    action: string,
    row?: EducationRecord,
  ) => Promise<void>;
};
function NoteAction({
  label,
  action,
  noteLabel,
  row,
  save,
  busy,
}: ActionProps & { label: string; action: string; noteLabel: string }) {
  return (
    <details>
      <summary>{label}</summary>
      <form onSubmit={(event) => void save(event, action, row)}>
        <label>
          {noteLabel}
          <textarea name="note" required maxLength={2000} />
        </label>
        <button disabled={busy}>{label}</button>
      </form>
    </details>
  );
}
function Decision({
  action,
  choices,
  row,
  save,
  busy,
}: ActionProps & { action: string; choices: string[][] }) {
  return (
    <details>
      <summary>Record decision</summary>
      <form onSubmit={(event) => void save(event, action, row)}>
        <label>
          Decision
          <select name="status">
            {choices.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Decision remarks
          <textarea name="note" required maxLength={2000} />
        </label>
        <button disabled={busy}>Save oversight decision</button>
      </form>
    </details>
  );
}
