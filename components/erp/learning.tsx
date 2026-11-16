'use client';
import { RecordPreview } from './record-preview';
import { useEffect, useState, type SubmitEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import type { Notice, Workspace } from '@/lib/erp/model';
import type { LearningView, Assessment } from '@/lib/erp/learning';
import { request, errorMessage } from './client';

export function LearningPanel({
  workspace,
  date,
  initialView = 'home',
  notices = [],
  hideNavigation = false,
  onNavigate,
}: {
  workspace: Workspace;
  date: string;
  initialView?: string;
  notices?: Notice[];
  hideNavigation?: boolean;
  onNavigate?: (view: string) => void;
}) {
  const parent = workspace.account.role === 'parent';
  const teacher = workspace.account.role === 'teacher';
  const [data, setData] = useState<LearningView>();
  const [view, setView] = useState(initialView);
  function navigate(next: string) {
    setView(next);
    onNavigate?.(next);
  }
  const [childId, setChildId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<LearningView>(`learning?date=${date}`, undefined, controller.signal)
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
  async function save(event: SubmitEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('learning', {
        ...fields,
        ...Object.fromEntries(
          ['score', 'maximum', 'version']
            .filter((key) => fields[key] !== undefined)
            .map((key) => [key, Number(fields[key])]),
        ),
        action,
      });
      setData(await request<LearningView>(`learning?date=${date}`));
      setMessage(
        action === 'publish'
          ? 'Result published to the linked family.'
          : action === 'edit-assessment'
            ? 'Draft result corrected. It remains hidden until publication.'
            : action === 'assessment'
              ? 'Marks saved for principal publication.'
              : action === 'homework'
                ? 'Homework assigned to the class.'
                : action === 'feedback'
                  ? 'Teacher feedback saved.'
                  : 'Completion reported to the teacher.',
      );
      form.reset();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const child =
    data?.learners.find((row) => row.id === childId) ?? data?.learners[0];
  const results =
    data?.assessments.filter((row) => !parent || row.studentId === child?.id) ??
    [];
  const homework =
    data?.homework.filter((row) => !parent || row.classId === child?.classId) ??
    [];
  const attendance =
    data?.attendance.filter((row) => row.studentId === child?.id) ?? [];
  const counted = attendance.filter((row) => row.mark !== null);
  const present = counted.filter((row) => row.mark === 'present').length;
  const submissions =
    data?.submissions.filter((row) => !parent || row.studentId === child?.id) ??
    [];
  const pending = homework.filter(
    (row) =>
      !submissions.some(
        (item) => item.homeworkId === row.id && item.studentId === child?.id,
      ),
  );
  const latestExam = results[0];
  const examRows = results.filter(
    (row) =>
      row.exam === latestExam?.exam &&
      row.day === latestExam?.day &&
      row.studentId === latestExam?.studentId,
  );
  const total = examRows.reduce((n, row) => n + row.score, 0),
    maximum = examRows.reduce((n, row) => n + row.maximum, 0);
  const subjects = [...new Set(results.map((row) => row.subject))];
  return (
    <section className="erp-card erp-learning">
      <header className="erp-card-title">
        <div>
          <span className="erp-eyebrow">
            {parent ? 'FAMILY LEARNING CENTRE' : 'CLASSROOM LEARNING'}
          </span>
          <h2>{parent ? 'Student progress' : 'Assessments and homework'}</h2>
          <p>
            {parent
              ? 'Attendance, published assessments and class assignments.'
              : 'Enter individual results, assign classwork and give families useful feedback.'}
          </p>
        </div>
        <button type="button" onClick={() => setReload(reload + 1)}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </header>
      {!hideNavigation && (
        <nav className="erp-section-tabs" aria-label="Learning sections">
          {(parent
            ? [
                ['home', 'Home'],
                ['attendance', 'Attendance'],
                ['academics', 'Academics'],
                ['homework', 'Homework'],
              ]
            : [
                ['academics', 'Marks & publication'],
                ['homework', 'Homework & feedback'],
              ]
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                navigate(id);
                setMessage('');
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <p className="erp-error" role="alert">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data ? (
        <output>Loading learning records…</output>
      ) : !data.learners.length ? (
        <div className="erp-empty-state">
          <GraduationCap size={24} />
          <h3>{parent ? 'No linked child' : 'No learners assigned'}</h3>
          <p>Ask the school administrator to check the account’s assignment.</p>
        </div>
      ) : (
        <>
          {parent && (
            <div className="erp-learning-child">
              <div className="erp-child-icon">
                <GraduationCap size={23} />
              </div>
              <div>
                <h3>{child?.name}</h3>
                <p>
                  {child?.classLabel} · Roll {child?.roll}
                </p>
                <small>{child?.schoolName}</small>
              </div>
              {data.learners.length > 1 && (
                <label>
                  Child
                  <select
                    value={child?.id}
                    onChange={(event) => setChildId(event.target.value)}
                  >
                    {data.learners.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {row.classLabel}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {parent && view === 'home' && (
            <>
              <div className="erp-learning-kpis">
                <button onClick={() => navigate('attendance')}>
                  <CalendarDays size={19} />
                  <span>Reported attendance · {data.month}</span>
                  <strong>
                    {counted.length
                      ? `${((100 * present) / counted.length).toFixed(1)}%`
                      : '—'}
                  </strong>
                  <small>
                    {present} present / {counted.length} reported days
                  </small>
                </button>
                <button onClick={() => navigate('academics')}>
                  <GraduationCap size={19} />
                  <span>Latest published assessment</span>
                  <strong>
                    {maximum ? `${((100 * total) / maximum).toFixed(1)}%` : '—'}
                  </strong>
                  <small>
                    {latestExam
                      ? `${latestExam.exam} · ${examRows.length} published subjects`
                      : 'Results will appear after publication'}
                  </small>
                </button>
                <button onClick={() => navigate('homework')}>
                  <BookOpen size={19} />
                  <span>Homework awaiting completion</span>
                  <strong>{pending.length}</strong>
                  <small>{homework.length} assignments in this view</small>
                </button>
              </div>
              <div className="erp-learning-columns">
                <section className="erp-learning-box">
                  <h3>Next learning tasks</h3>
                  {pending
                    .slice()
                    .sort((a, b) => a.due.localeCompare(b.due))
                    .slice(0, 3)
                    .map((row) => (
                      <button
                        className="erp-learning-link"
                        key={row.id}
                        onClick={() => navigate('homework')}
                      >
                        <span>
                          <strong>{row.title}</strong>
                          <small>
                            {row.subject} · Due {row.due}
                          </small>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  {!pending.length && <p>No pending homework in this view.</p>}
                </section>
                <section className="erp-learning-box">
                  <h3>Latest teacher feedback</h3>
                  {results.slice(0, 3).map((row) => (
                    <div className="erp-feedback-row" key={row.id}>
                      <strong>
                        {row.subject} · {row.exam}
                      </strong>
                      <p>{row.feedback}</p>
                    </div>
                  ))}
                  {!results.length && (
                    <p>Feedback appears with published results.</p>
                  )}
                </section>
              </div>
              <section className="erp-learning-box" style={{ marginTop: 20 }}>
                <h3>Latest school notices</h3>
                {notices
                  .filter((row) => row.schoolId === child?.schoolId)
                  .slice(0, 2)
                  .map((row) => (
                    <div className="erp-feedback-row" key={row.id}>
                      <strong>{row.title}</strong>
                      <p>{row.body}</p>
                    </div>
                  ))}
                {!notices.some((row) => row.schoolId === child?.schoolId) && (
                  <p>No school notices yet.</p>
                )}
              </section>
            </>
          )}
          {parent && view === 'attendance' && (
            <>
              <div className="erp-portal-section-heading">
                <h3>Attendance calendar · {data.month}</h3>
                <span className="erp-tag">As of {date}</span>
              </div>
              <div className="erp-attendance-counts">
                {[
                  ['present', 'Present'],
                  ['absent', 'Absent'],
                  ['leave', 'On leave'],
                ].map(([id, label]) => (
                  <span key={id}>
                    <i className={`erp-dot erp-dot-${id}`} />
                    <strong>
                      {attendance.filter((row) => row.mark === id).length}
                    </strong>
                    {label}
                  </span>
                ))}
                <span>
                  <strong>
                    {
                      attendance.filter((row) => row.status === 'returned')
                        .length
                    }
                  </strong>
                  Being corrected
                </span>
              </div>
              <div className="erp-calendar">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                  (day) => (
                    <strong key={day}>{day}</strong>
                  ),
                )}
                {Array.from(
                  {
                    length:
                      (new Date(data.month + '-01T12:00:00Z').getUTCDay() + 6) %
                      7,
                  },
                  (_, i) => (
                    <span key={`empty-${i}`} />
                  ),
                )}
                {Array.from(
                  {
                    length: new Date(
                      Number(data.month.slice(0, 4)),
                      Number(data.month.slice(5)),
                      0,
                    ).getDate(),
                  },
                  (_, i) => {
                    const day = `${data.month}-${String(i + 1).padStart(2, '0')}`;
                    const entry = attendance.find((row) => row.day === day);
                    const label =
                      day > date
                        ? 'Not in selected period'
                        : entry?.mark === 'present'
                          ? 'Present'
                          : entry?.mark === 'absent'
                            ? 'Absent'
                            : entry?.mark === 'leave'
                              ? 'On leave'
                              : entry?.status === 'returned'
                                ? 'Being corrected'
                                : 'Not reported';
                    return (
                      <div
                        className={`erp-calendar-day erp-day-${entry?.mark ?? 'unknown'}`}
                        key={day}
                        aria-label={`${day}: ${label}`}
                      >
                        <strong>{i + 1}</strong>
                        <span>{label}</span>
                      </div>
                    );
                  },
                )}
              </div>
              <p className="erp-directory-help">
                Use the date selector above to choose a month and reporting
                cut-off. Attendance rate uses only reported present, absent and
                leave days. Unreported days are not absences; this pilot has no
                school holiday calendar. Returned registers are excluded until
                resubmitted.
              </p>
            </>
          )}
          {view === 'academics' && (
            <>
              {teacher && (
                <details className="erp-learning-editor">
                  <summary>Enter a learner’s marks & feedback</summary>
                  <form
                    className="erp-portal-form"
                    onSubmit={(event) => void save(event, 'assessment')}
                  >
                    <label>
                      Learner
                      <select name="studentId" required>
                        {data.learners.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name} · {row.classLabel} · Roll {row.roll}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assessment name
                      <input
                        name="exam"
                        required
                        maxLength={100}
                        placeholder="e.g. Unit Test 2"
                      />
                    </label>
                    <label>
                      Subject
                      <input name="subject" required maxLength={60} />
                    </label>
                    <label>
                      Assessment date
                      <input
                        type="date"
                        name="day"
                        required
                        max={workspace.date}
                        defaultValue={date}
                      />
                    </label>
                    <label>
                      Marks obtained
                      <input
                        name="score"
                        type="number"
                        min={0}
                        max={1000}
                        step="0.5"
                        required
                      />
                    </label>
                    <label>
                      Maximum marks
                      <input
                        name="maximum"
                        type="number"
                        min={1}
                        max={1000}
                        step="0.5"
                        defaultValue={100}
                        required
                      />
                    </label>
                    <label>
                      Strengths & next steps
                      <textarea name="feedback" maxLength={1000} required />
                    </label>
                    <button className="erp-primary" disabled={busy}>
                      Save for principal review
                    </button>
                  </form>
                </details>
              )}
              {parent && (
                <>
                  <div className="erp-portal-section-heading">
                    <h3>Subject progress</h3>
                    <span className="erp-tag">Published results only</span>
                  </div>
                  <div className="erp-subject-grid">
                    {subjects.map((subject) => {
                      const rows = results
                        .filter((row) => row.subject === subject)
                        .sort((a, b) => b.day.localeCompare(a.day));
                      const latest = rows[0],
                        previous = rows[1];
                      const change = previous
                        ? (100 * latest.score) / latest.maximum -
                          (100 * previous.score) / previous.maximum
                        : null;
                      return (
                        <article key={subject}>
                          <h3>{subject}</h3>
                          <strong>
                            {latest.score}/{latest.maximum}
                          </strong>
                          <progress
                            max={100}
                            value={(100 * latest.score) / latest.maximum}
                            aria-label={`${subject} latest percentage`}
                          />
                          <small>
                            {latest.exam} · {latest.day}
                          </small>
                          <p>
                            {change === null
                              ? 'First published result'
                              : `${change >= 0 ? '+' : ''}${change.toFixed(1)} percentage points from previous result`}
                          </p>
                          <p>{latest.feedback}</p>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="erp-portal-section-heading">
                <h3>
                  {parent ? 'Published report cards' : 'Assessment register'}
                </h3>
                <span className="erp-tag">
                  {results.length} subject results
                </span>
              </div>
              <p className="erp-directory-help">
                Each result is an individual subject record. A report card
                contains the subjects published so far; it is not a complete
                term report unless the school has entered and published every
                subject.
              </p>
              <RecordPreview
                key={`${view}:0`}
                className="erp-portal-records"
                label="Learning records"
                presentation={parent && view === 'academics' ? 'grid' : 'list'}
              >
                {parent
                  ? [
                      ...new Set(
                        results.map((row) => `${row.exam}::${row.day}`),
                      ),
                    ].map((key) => {
                      const rows = results.filter(
                        (row) => `${row.exam}::${row.day}` === key,
                      );
                      const earned = rows.reduce((n, row) => n + row.score, 0),
                        possible = rows.reduce((n, row) => n + row.maximum, 0);
                      return (
                        <article className="erp-portal-record" key={key}>
                          <header>
                            <div>
                              <span className="erp-eyebrow">
                                {rows[0].day} · Published subject results
                              </span>
                              <h3>{rows[0].exam}</h3>
                            </div>
                            <strong>
                              {possible
                                ? ((100 * earned) / possible).toFixed(1)
                                : '—'}
                              %
                            </strong>
                          </header>
                          <div className="erp-scroll">
                            <table className="erp-table">
                              <thead>
                                <tr>
                                  <th>Subject</th>
                                  <th>Marks</th>
                                  <th>Teacher feedback</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.subject}</td>
                                    <td>
                                      {row.score}/{row.maximum}
                                    </td>
                                    <td>{row.feedback}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p>
                            Total of published subjects: {earned}/{possible}.{' '}
                            {rows.length} subjects included.
                          </p>
                        </article>
                      );
                    })
                  : results.map((row) => (
                      <Result
                        key={row.id}
                        row={row}
                        principal={workspace.account.role === 'principal'}
                        showLearner={!parent}
                        editable={teacher}
                        busy={busy}
                        save={save}
                      />
                    ))}
                {!results.length && (
                  <div className="erp-empty-state">
                    No {parent ? 'published ' : ''}assessment results yet.
                  </div>
                )}
              </RecordPreview>
            </>
          )}
          {view === 'homework' && (
            <>
              {teacher && (
                <details className="erp-learning-editor">
                  <summary>Assign new homework</summary>
                  <form
                    className="erp-portal-form"
                    onSubmit={(event) => void save(event, 'homework')}
                  >
                    <label>
                      Class
                      <select name="classId" required>
                        {data.classes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.grade} · {row.section}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <input name="subject" required maxLength={60} />
                    </label>
                    <label>
                      Homework title
                      <input name="title" required maxLength={120} />
                    </label>
                    <label>
                      Due date
                      <input name="due" type="date" required />
                    </label>
                    <label>
                      Instructions
                      <textarea name="body" required maxLength={2000} />
                    </label>
                    <button className="erp-primary" disabled={busy}>
                      Assign to class
                    </button>
                  </form>
                </details>
              )}
              <p className="erp-directory-help">
                Parents report completion with a note. This does not upload a
                file or automatically mark the work as checked. Assigned
                teachers can add feedback.
              </p>
              <RecordPreview
                key={`${view}:1`}
                className="erp-portal-records"
                label="Learning records"
                presentation="list"
              >
                {homework.map((row) => {
                  const submission = submissions.find(
                    (item) =>
                      item.homeworkId === row.id &&
                      item.studentId === child?.id,
                  );
                  return (
                    <article key={row.id} className="erp-portal-record">
                      <header>
                        <div>
                          <span className="erp-eyebrow">
                            {row.subject} · Due {row.due}
                          </span>
                          <h3>{row.title}</h3>
                        </div>
                        {parent && (
                          <span className="erp-status">
                            {submission?.feedback
                              ? 'Teacher feedback'
                              : submission
                                ? 'Completion reported'
                                : row.due < workspace.date
                                  ? 'Overdue'
                                  : 'To do'}
                          </span>
                        )}
                      </header>
                      <p>{row.body}</p>
                      {parent && child && (
                        <>
                          {submission && (
                            <blockquote>
                              <strong>Your completion note</strong>
                              {submission.note}
                              {submission.feedback && (
                                <>
                                  <strong>Teacher feedback</strong>
                                  {submission.feedback}
                                </>
                              )}
                            </blockquote>
                          )}
                          <details>
                            <summary>
                              {submission
                                ? 'Update completion note'
                                : 'Report homework completion'}
                            </summary>
                            <form
                              onSubmit={(event) => void save(event, 'submit')}
                            >
                              <input type="hidden" name="id" value={row.id} />
                              <input
                                type="hidden"
                                name="studentId"
                                value={child.id}
                              />
                              <input
                                type="hidden"
                                name="version"
                                value={submission?.version ?? 0}
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
                                Send to teacher
                              </button>
                            </form>
                          </details>
                        </>
                      )}
                      {!parent && (
                        <>
                          <small>
                            {
                              submissions.filter(
                                (item) => item.homeworkId === row.id,
                              ).length
                            }{' '}
                            completion reports in your scope
                          </small>
                          {submissions
                            .filter((item) => item.homeworkId === row.id)
                            .map((item) => (
                              <div
                                className="erp-feedback-row"
                                key={item.studentId}
                              >
                                <strong>{item.studentName}</strong>
                                <p>{item.note}</p>
                                {item.feedback && (
                                  <blockquote>{item.feedback}</blockquote>
                                )}
                                {teacher && (
                                  <form
                                    onSubmit={(event) =>
                                      void save(event, 'feedback')
                                    }
                                  >
                                    <input
                                      type="hidden"
                                      name="id"
                                      value={row.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="studentId"
                                      value={item.studentId}
                                    />
                                    <input
                                      type="hidden"
                                      name="version"
                                      value={item.version}
                                    />
                                    <label>
                                      Teacher feedback
                                      <textarea
                                        name="feedback"
                                        required
                                        maxLength={1000}
                                      />
                                    </label>
                                    <button disabled={busy}>
                                      Save feedback
                                    </button>
                                  </form>
                                )}
                              </div>
                            ))}
                        </>
                      )}
                    </article>
                  );
                })}
                {!homework.length && (
                  <div className="erp-empty-state">
                    No homework assigned to this class yet.
                  </div>
                )}
              </RecordPreview>
            </>
          )}
        </>
      )}
    </section>
  );
}
function Result({
  row,
  principal,
  showLearner,
  editable,
  busy,
  save,
}: {
  row: Assessment;
  principal: boolean;
  showLearner: boolean;
  editable: boolean;
  busy: boolean;
  save: (event: SubmitEvent<HTMLFormElement>, action: string) => Promise<void>;
}) {
  return (
    <article className="erp-portal-record">
      <header>
        <div>
          <span className="erp-eyebrow">
            {row.exam} · {row.day}
          </span>
          <h3>
            {row.subject} · {row.score}/{row.maximum}
          </h3>
        </div>
        <span className={`erp-status ${row.published ? 'erp-reviewed' : ''}`}>
          {row.published ? 'Published' : 'Awaiting publication'}
        </span>
      </header>
      {showLearner && <small>{row.studentName}</small>}
      <p>{row.feedback}</p>
      {editable && !row.published && (
        <details>
          <summary>Edit draft result</summary>
          <form onSubmit={(event) => void save(event, 'edit-assessment')}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="version" value={row.version} />
            <label>
              Marks obtained
              <input
                name="score"
                type="number"
                min={0}
                max={1000}
                step="0.5"
                defaultValue={row.score}
                required
              />
            </label>
            <label>
              Maximum marks
              <input
                name="maximum"
                type="number"
                min={1}
                max={1000}
                step="0.5"
                defaultValue={row.maximum}
                required
              />
            </label>
            <label>
              Feedback
              <textarea
                name="feedback"
                maxLength={1000}
                defaultValue={row.feedback}
                required
              />
            </label>
            <button disabled={busy}>Save draft correction</button>
          </form>
        </details>
      )}
      {principal && !row.published && (
        <form onSubmit={(event) => void save(event, 'publish')}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <button className="erp-primary" disabled={busy}>
            <ClipboardCheck size={14} />
            Publish to family
          </button>
        </form>
      )}
    </article>
  );
}
