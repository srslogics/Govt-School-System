'use client';

import {
  useEffect,
  useState,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import {
  attendanceRate,
  marks,
  type Counts,
  type Mark,
  type RegisterView,
  type Report,
  type Role,
} from '@/lib/erp/model';
import {
  ArrowDownToLine,
  ArrowUpRight,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { errorMessage, request } from './client';

const statusLabel = { present: 'Present', absent: 'Absent', leave: 'On leave' };

export function RegisterPanel({
  classId,
  date,
  role,
  onSaved,
}: {
  classId: string;
  date: string;
  role: Role;
  onSaved: () => void;
}) {
  const path = `register/${encodeURIComponent(classId)}/${encodeURIComponent(date)}`;
  const [view, setView] = useState<RegisterView>();
  const [values, setValues] = useState<Record<string, Mark>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<RegisterView>(path, undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setView(result);
        setValues(
          Object.fromEntries(
            (result.register?.entries ?? []).map((entry) => [
              entry.id,
              entry.mark,
            ]),
          ),
        );
        setError('');
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, [path, reload]);

  if (!view)
    return error ? (
      <p role="alert" className="erp-error">
        {error}
      </p>
    ) : (
      <output>Loading register…</output>
    );
  const status =
    view.register?.status ??
    (view.roster.length ? 'not submitted' : 'no enrolment');
  const editable =
    role === 'teacher' &&
    view.roster.length > 0 &&
    (!view.register || status === 'returned');
  const reviewable = role === 'principal' && status === 'submitted';
  const marked = view.roster.filter((student) => values[student.id]).length;
  async function save(event: ReactSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || busy) return;
    const submitter = event.nativeEvent.submitter;
    const action =
      submitter instanceof HTMLButtonElement ? submitter.value : 'submit';
    setError('');
    setSaved('');
    setBusy(true);
    try {
      const result = await request<RegisterView>(path, {
        action,
        version: view.register?.version ?? 0,
        marks: values,
        note,
      });
      setView(result);
      setNote('');
      setSaved(
        action === 'return'
          ? 'Register returned for correction.'
          : action === 'review'
            ? 'Review recorded.'
            : 'Register submitted.',
      );
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="erp-card">
      <header className="erp-card-title">
        <div>
          <h2>
            {view.classSection.grade} · Section {view.classSection.section}
          </h2>
          <p>
            {view.school.name} · {date}
          </p>
        </div>
        <span className={`erp-status erp-${status.replaceAll(' ', '-')}`}>
          {status}
        </span>
      </header>
      {error && (
        <div className="erp-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setReload(reload + 1)}>
            Reload register
          </button>
        </div>
      )}
      {saved && <output className="erp-success">{saved}</output>}
      {status === 'returned' && (
        <p className="erp-callout">
          Returned for correction. The reason is in the history below.
        </p>
      )}
      <div className="erp-register-summary">
        <span>
          <strong>{view.roster.length}</strong> learners
        </span>
        <span>
          <i className="erp-dot erp-dot-present" />
          {
            Object.values(values).filter((mark) => mark === 'present').length
          }{' '}
          present
        </span>
        <span>
          <i className="erp-dot erp-dot-absent" />
          {
            Object.values(values).filter((mark) => mark === 'absent').length
          }{' '}
          absent
        </span>
        <span>
          <i className="erp-dot erp-dot-leave" />
          {Object.values(values).filter((mark) => mark === 'leave').length} on
          leave
        </span>
        {editable && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setValues(
                Object.fromEntries(
                  view.roster.map((student) => [student.id, 'present' as Mark]),
                ),
              )
            }
          >
            <CheckCheck size={15} />
            Mark all present
          </button>
        )}
      </div>
      {editable && (
        <p className="erp-mark-progress">
          {marked} of {view.roster.length} marked. Check each learner before
          submitting.
        </p>
      )}
      <form onSubmit={(event) => void save(event)}>
        {view.roster.length ? (
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {view.roster.map((student) => (
                  <tr key={student.id}>
                    <td>{student.roll}</td>
                    <td>{student.name}</td>
                    <td>
                      {editable ? (
                        <select
                          aria-label={`Attendance for ${student.name}`}
                          value={values[student.id] ?? ''}
                          required
                          disabled={busy}
                          onChange={(event) =>
                            setValues({
                              ...values,
                              [student.id]: event.target.value as Mark,
                            })
                          }
                        >
                          <option value="" disabled>
                            Choose status
                          </option>
                          {marks.map((mark) => (
                            <option key={mark} value={mark}>
                              {statusLabel[mark]}
                            </option>
                          ))}
                        </select>
                      ) : values[student.id] ? (
                        statusLabel[values[student.id]]
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No students are enrolled for this date.</p>
        )}
        {(editable || reviewable) && (
          <div className="erp-form-actions">
            {(reviewable || status === 'returned') && (
              <label>
                {reviewable
                  ? 'Review note (required when returning)'
                  : 'Correction note'}
                <textarea
                  maxLength={500}
                  value={note}
                  required={editable}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            )}
            <div className="erp-actions">
              {editable && (
                <button className="erp-primary" value="submit" disabled={busy}>
                  {status === 'returned'
                    ? 'Resubmit register'
                    : 'Submit register'}
                </button>
              )}
              {reviewable && (
                <>
                  <button
                    className="erp-primary"
                    value="review"
                    disabled={busy}
                  >
                    Mark reviewed
                  </button>
                  <button value="return" disabled={busy}>
                    Return for correction
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </form>
      <div className="erp-history">
        <h3>Register history</h3>
        {view.history.length ? (
          <ol>
            {view.history.map((event, index) => (
              <li key={index}>
                <strong>{event.action}</strong> · {event.actor} ·{' '}
                <time dateTime={event.at}>
                  {new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(event.at))}
                </time>
                {event.changedMarks > 0 && (
                  <span> · {event.changedMarks} marks recorded or changed</span>
                )}
                {event.note && <p>{event.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p>No submissions recorded.</p>
        )}
      </div>
    </section>
  );
}

function CountsLine({ counts }: { counts: Counts }) {
  return (
    <>
      {counts.present} present / {counts.absent} absent / {counts.leave} on
      leave
    </>
  );
}

export function ReportPanel({
  date,
  schoolId,
  canReview,
  onOpen,
  onSchool,
}: {
  date: string;
  schoolId: string;
  canReview: boolean;
  onOpen: (classId: string) => void;
  onSchool: (schoolId: string) => void;
}) {
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const query = new URLSearchParams({
    date,
    ...(schoolId ? { school: schoolId } : {}),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    request<Report>(`report?${query}`, undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setReport(result);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setReport(undefined);
          setError(errorMessage(failure));
        }
      });
    return () => controller.abort();
  }, [query, reload]);
  if (!report)
    return error ? (
      <p role="alert" className="erp-error">
        {error}
      </p>
    ) : (
      <output>Loading attendance summary…</output>
    );

  const { totals } = report;
  return (
    <section className="erp-card">
      <header className="erp-card-title">
        <div>
          <h2>Daily attendance</h2>
          <p>
            {report.date} · {report.schools.length} schools in this view
          </p>
        </div>
        <div className="erp-report-actions">
          <button type="button" onClick={() => setReload(reload + 1)}>
            <RefreshCw size={14} /> Refresh
          </button>
          <a
            className="erp-button"
            href={`/api/erp/report?${query}&format=csv`}
          >
            <ArrowDownToLine size={14} /> Export CSV
          </a>
        </div>
      </header>
      <dl className="erp-kpis">
        <div>
          <dt>Attendance rate</dt>
          <dd>{attendanceRate(totals)}</dd>
          <small>
            {totals.present} of {totals.total} marks present
          </small>
        </div>
        <div>
          <dt>Registers included</dt>
          <dd>
            {totals.submitted + totals.reviewed}/{totals.expected}
          </dd>
          <small>
            {totals.reviewed} reviewed · {totals.submitted} awaiting review
          </small>
        </div>
        <div>
          <dt>Not submitted</dt>
          <dd>{totals.missing}</dd>
          <small>{totals.returned} returned for correction</small>
        </div>
      </dl>
      <div className="erp-report-insight">
        <span className="erp-insight-icon">!</span>
        <p>
          <strong>
            {totals.missing + totals.returned
              ? `${totals.missing + totals.returned} ${totals.missing + totals.returned === 1 ? 'register needs' : 'registers need'} follow-up`
              : totals.expected
                ? 'All expected registers are included'
                : 'No registers expected for this date'}
          </strong>
          <span>
            {totals.missing ? `${totals.missing} not yet submitted. ` : ''}
            {totals.returned
              ? `${totals.returned} returned for correction. `
              : ''}
            {totals.submitted
              ? `${totals.submitted} awaiting principal review.`
              : 'Review submission coverage alongside the attendance rate.'}
          </span>
        </p>
      </div>
      <div className="erp-school-list-heading">
        <h3>{schoolId ? 'School detail' : 'Schools in your workspace'}</h3>
        <span>
          {report.schools.length}{' '}
          {report.schools.length === 1 ? 'school' : 'schools'}
        </span>
      </div>
      {report.schools.length === 0 && (
        <p>No schools are assigned to this account.</p>
      )}
      {report.schools.map(({ school, totals: counts, classes }) => (
        <section className="erp-report-school" key={school.id}>
          <div className="erp-school-heading">
            <div>
              <span className="erp-eyebrow">{school.code}</span>
              <h3>{school.name}</h3>
            </div>
            <div className="erp-school-rate">
              <strong>{attendanceRate(counts)}</strong>
              <small>attendance</small>
            </div>
          </div>
          <div className="erp-school-coverage">
            <span>
              {counts.submitted + counts.reviewed} / {counts.expected} registers
              included
            </span>
            <span>
              {counts.missing} missing · {counts.returned} returned
            </span>
          </div>
          <progress
            className="erp-coverage-track"
            aria-label={`${school.name} register coverage`}
            max={Math.max(counts.expected, 1)}
            value={counts.submitted + counts.reviewed}
          />
          <div className="erp-school-meta">
            <span>
              <CountsLine counts={counts} />
            </span>
            {!schoolId && (
              <button type="button" onClick={() => onSchool(school.id)}>
                View school <ArrowUpRight size={14} />
              </button>
            )}
          </div>
          {classes?.length ? (
            <div className="erp-scroll">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Class / section</th>
                    <th>Status</th>
                    <th>Roster</th>
                    <th>Marks included</th>
                    {canReview && <th>Register</th>}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((row) => (
                    <tr key={row.classSection.id}>
                      <td>
                        {row.classSection.grade} · {row.classSection.section}
                      </td>
                      <td>
                        <span
                          className={`erp-status erp-${row.status.replaceAll(' ', '-')}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.enrolled}</td>
                      <td>
                        {row.counts.total ? (
                          <CountsLine counts={row.counts} />
                        ) : (
                          '—'
                        )}
                      </td>
                      {canReview && (
                        <td>
                          <button
                            type="button"
                            onClick={() => onOpen(row.classSection.id)}
                          >
                            {row.status === 'submitted'
                              ? 'Review register'
                              : 'Open register'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            classes && <p>No classes configured for this date.</p>
          )}
        </section>
      ))}
      <details className="erp-methodology">
        <summary>How these figures are calculated</summary>
        <p>
          Attendance is present marks divided by all marks in submitted and
          reviewed registers. On-leave marks are included. Missing and returned
          registers are excluded from the rate. Coverage counts classes with
          enrolment effective on the selected date; empty classes do not count
          as missing.
        </p>
      </details>
    </section>
  );
}
