'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { Workspace } from '@/lib/erp/model';
import type { TeacherView } from '@/lib/erp/teacher';
import { request, errorMessage } from './client';
const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export function TeacherPanel({
  workspace,
  date,
  view,
  onNavigate,
  onOpenRegister,
  embedded = false,
}: {
  workspace: Workspace;
  date: string;
  view: string;
  onNavigate: (view: string) => void;
  onOpenRegister?: (classId: string) => void;
  embedded?: boolean;
}) {
  const [data, setData] = useState<TeacherView>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState(workspace.classes[0]?.id ?? '');
  const principal = workspace.account.role === 'principal';
  useEffect(() => {
    const controller = new AbortController();
    request<TeacherView>(`teacher?date=${date}`, undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, [date, reload]);
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay() || 7;
  const lessons = data?.lessons.filter((row) => row.weekday === weekday) ?? [];
  const student =
    data?.learners.find((row) => row.id === studentId) ?? data?.learners[0];
  async function timetable(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      await request('teacher', { ...fields, weekday: Number(fields.weekday) });
      setData(await request<TeacherView>(`teacher?date=${date}`));
      setMessage('Timetable period added.');
      form.reset();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="erp-card erp-teacher">
      <header className="erp-card-title">
        <div>
          <span className="erp-eyebrow">
            {principal ? 'SCHOOL TEACHING PLAN' : 'TEACHER WORKSPACE'}
          </span>
          <h2>
            {view === 'day'
              ? embedded
                ? 'Teaching summary'
                : 'My Day'
              : view === 'timetable'
                ? 'Weekly timetable'
                : view === 'students'
                  ? 'Student profiles'
                  : 'Class marks entry'}
          </h2>
          <p>
            {view === 'day'
              ? `Your teaching and follow-up for ${date}.`
              : view === 'timetable'
                ? 'Recurring weekly periods for your assigned classes.'
                : view === 'students'
                  ? 'Learning records for the students in your assigned classes.'
                  : 'Save marks for multiple learners and correct drafts before principal publication.'}
          </p>
        </div>
        <button onClick={() => setReload(reload + 1)}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </header>
      {error && (
        <p className="erp-error" role="alert">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data ? (
        <output>Loading teacher workspace…</output>
      ) : (
        <>
          {view === 'day' && (
            <>
              <div className="erp-learning-kpis">
                <button onClick={() => onNavigate('teacher-timetable')}>
                  <CalendarDays size={18} />
                  <span>Periods on selected day</span>
                  <strong>{lessons.length}</strong>
                  <small>{days[weekday - 1]}</small>
                </button>
                <button onClick={() => onNavigate('teacher-marks')}>
                  <GraduationCap size={18} />
                  <span>Draft subject results</span>
                  <strong>
                    {data.assessments.filter((row) => !row.published).length}
                  </strong>
                  <small>Awaiting principal publication</small>
                </button>
                <button onClick={() => onNavigate('learning')}>
                  <BookOpen size={18} />
                  <span>Homework awaiting feedback</span>
                  <strong>
                    {data.submissions.filter((row) => !row.feedback).length}
                  </strong>
                  <small>Parent completion notes to review</small>
                </button>
              </div>
              <div className="erp-learning-columns">
                <section className="erp-learning-box">
                  <h3>Your teaching day</h3>
                  {lessons.map((row) => (
                    <div className="erp-day-period" key={row.id}>
                      <span>
                        {row.start}
                        <small>{row.end}</small>
                      </span>
                      <div>
                        <strong>{row.subject}</strong>
                        <p>
                          {row.classLabel} · {row.room}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!lessons.length && (
                    <p>
                      No timetable periods recorded for this weekday. This does
                      not imply a school holiday.
                    </p>
                  )}
                  <button onClick={() => onNavigate('teacher-timetable')}>
                    View full timetable
                  </button>
                </section>
                <section className="erp-learning-box">
                  <h3>Class attendance</h3>
                  {data.registers.map((row) => {
                    const section = data.classes.find(
                      (item) => item.id === row.classId,
                    );
                    return (
                      <div className="erp-day-register" key={row.classId}>
                        <div>
                          <strong>
                            {section?.grade} · {section?.section}
                          </strong>
                          <small>
                            {row.enrolled} enrolled · {row.status}
                          </small>
                        </div>
                        {onOpenRegister && (
                          <button onClick={() => onOpenRegister(row.classId)}>
                            Open register
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!data.registers.length && (
                    <p>No effective class enrolment for this date.</p>
                  )}
                </section>
              </div>
              <div className="erp-portal-next">
                <button onClick={() => onNavigate('teacher-students')}>
                  <Users size={16} />
                  Open student profiles
                </button>
                <button onClick={() => onNavigate('teacher-marks')}>
                  <ClipboardCheck size={16} />
                  Enter class marks
                </button>
              </div>
            </>
          )}
          {view === 'timetable' && (
            <>
              <p className="erp-directory-help">
                The meeting demo contains a clearly labelled fictional weekly
                schedule. Actual periods must be confirmed by the school.
                Principals manage periods; teachers see only their own
                timetable. Calendar exceptions and substitutions are not
                modelled yet.
              </p>
              {principal && (
                <details className="erp-learning-editor">
                  <summary>Add a teaching period</summary>
                  <form
                    className="erp-portal-form"
                    onSubmit={(event) => void timetable(event)}
                  >
                    <label>
                      Class
                      <select
                        name="classId"
                        value={classId}
                        onChange={(event) => setClassId(event.target.value)}
                        required
                      >
                        {data.classes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.grade} · {row.section}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Teacher
                      <select
                        name="teacherId"
                        key={classId}
                        defaultValue=""
                        required
                      >
                        <option value="" disabled>
                          Choose assigned teacher
                        </option>
                        {data.teachers
                          .filter((row) => row.classId === classId)
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Weekday
                      <select name="weekday">
                        {days.map((day, index) => (
                          <option key={day} value={index + 1}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <input name="subject" maxLength={60} required />
                    </label>
                    <label>
                      Start time
                      <input name="start" type="time" required />
                    </label>
                    <label>
                      End time
                      <input name="end" type="time" required />
                    </label>
                    <label>
                      Room
                      <input name="room" maxLength={60} required />
                    </label>
                    <button className="erp-primary" disabled={busy}>
                      Add period
                    </button>
                  </form>
                </details>
              )}
              <div className="erp-timetable-grid">
                {days.map((day, index) => (
                  <section
                    className={`erp-timetable-day${weekday === index + 1 ? ' erp-timetable-today' : ''}`}
                    key={day}
                  >
                    <h3>
                      {day}
                      {weekday === index + 1 && <small>Selected day</small>}
                    </h3>
                    {data.lessons
                      .filter((row) => row.weekday === index + 1)
                      .map((row) => (
                        <article key={row.id}>
                          <span>
                            {row.start}–{row.end}
                          </span>
                          <strong>{row.subject}</strong>
                          <p>{row.classLabel}</p>
                          <small>
                            {row.room}
                            {principal ? ` · ${row.teacherName}` : ''}
                          </small>
                        </article>
                      ))}
                    {!data.lessons.some((row) => row.weekday === index + 1) && (
                      <p className="erp-directory-help">No periods recorded</p>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {view === 'students' && (
            <>
              <div className="erp-profile-layout">
                <section>
                  <label>
                    Find a learner
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Name, class or roll number"
                    />
                  </label>
                  <div className="erp-student-list">
                    {data.learners
                      .filter((row) =>
                        `${row.name} ${row.classLabel} ${row.roll}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((row) => (
                        <button
                          key={row.id}
                          aria-pressed={student?.id === row.id}
                          onClick={() => setStudentId(row.id)}
                        >
                          <strong>{row.name}</strong>
                          <small>
                            {row.classLabel} · Roll {row.roll}
                          </small>
                        </button>
                      ))}
                  </div>
                </section>
                {student ? (
                  <section>
                    <div className="erp-learning-child">
                      <div className="erp-child-icon">
                        <GraduationCap size={23} />
                      </div>
                      <div>
                        <h3>{student.name}</h3>
                        <p>
                          {student.classLabel} · Roll {student.roll}
                        </p>
                        <small>{student.schoolName}</small>
                      </div>
                    </div>
                    <h3>Attendance · {data.month}</h3>
                    <div className="erp-attendance-counts">
                      {['present', 'absent', 'leave'].map((mark) => (
                        <span key={mark}>
                          <strong>
                            {
                              data.attendance.filter(
                                (row) =>
                                  row.studentId === student.id &&
                                  row.mark === mark,
                              ).length
                            }
                          </strong>
                          {mark === 'leave' ? 'on leave' : mark}
                        </span>
                      ))}
                    </div>
                    <p className="erp-directory-help">
                      Counts include reported registers through the selected
                      date; missing and returned registers are not absences.
                    </p>
                    <h3>Assessment history & feedback</h3>
                    {data.assessments
                      .filter((row) => row.studentId === student.id)
                      .map((row) => (
                        <article className="erp-profile-result" key={row.id}>
                          <header>
                            <strong>
                              {row.subject} · {row.score}/{row.maximum}
                            </strong>
                            <span
                              className={`erp-status ${row.published ? 'erp-reviewed' : ''}`}
                            >
                              {row.published ? 'Published' : 'Draft'}
                            </span>
                          </header>
                          <small>
                            {row.exam} · {row.day}
                          </small>
                          <p>{row.feedback}</p>
                        </article>
                      ))}
                    {!data.assessments.some(
                      (row) => row.studentId === student.id,
                    ) && (
                      <p className="erp-directory-help">
                        No assessment records yet.
                      </p>
                    )}
                    <h3>Homework & follow-up</h3>
                    {data.homework
                      .filter((row) => row.classId === student.classId)
                      .map((row) => {
                        const submission = data.submissions.find(
                          (item) =>
                            item.homeworkId === row.id &&
                            item.studentId === student.id,
                        );
                        return (
                          <article className="erp-profile-result" key={row.id}>
                            <strong>{row.title}</strong>
                            <small>
                              {row.subject} · Due {row.due}
                            </small>
                            <p>
                              {submission
                                ? `Completion note: ${submission.note}`
                                : 'No parent completion report yet.'}
                            </p>
                            {submission?.feedback && (
                              <p>Teacher feedback: {submission.feedback}</p>
                            )}
                          </article>
                        );
                      })}
                  </section>
                ) : (
                  <div className="erp-empty-state">No learners assigned.</div>
                )}
              </div>
            </>
          )}
          {view === 'marks' && (
            <BulkMarks
              data={data}
              date={date}
              onSaved={(value) => {
                setMessage(value);
                setReload(reload + 1);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function BulkMarks({
  data,
  date,
  onSaved,
}: {
  data: TeacherView;
  date: string;
  onSaved: (message: string) => void;
}) {
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [exam, setExam] = useState('');
  const [day, setDay] = useState(date);
  const [maximum, setMaximum] = useState('100');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const learners = data.learners.filter((row) => row.classId === classId);
  const existing = (id: string) =>
    data.assessments.find(
      (row) =>
        row.studentId === id &&
        row.subject.toLowerCase() === subject.trim().toLowerCase() &&
        row.exam.toLowerCase() === exam.trim().toLowerCase() &&
        row.day === day,
    );
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => {
      const field = form.get(key);
      return typeof field === 'string' ? field : '';
    };
    const entries = learners
      .filter(
        (row) =>
          !existing(row.id)?.published &&
          value(`score-${row.id}`).trim() !== '',
      )
      .map((row) => ({
        studentId: row.id,
        score: Number(form.get(`score-${row.id}`)),
        feedback: value(`feedback-${row.id}`),
        version: existing(row.id)?.version ?? 0,
      }));
    if (!entries.length) {
      setError(
        'Enter marks for at least one learner. Published results are locked.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request('learning', {
        action: 'bulk-marks',
        classId,
        subject,
        exam,
        day,
        maximum: Number(maximum),
        entries,
      });
      onSaved(
        `${entries.length} draft results saved for principal publication.`,
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="erp-directory-help">
        Choose a class and assessment. Enter new marks or load existing drafts
        using the same subject, assessment name and date. Blank marks are
        skipped. Published results are locked. Each saved row needs individual
        feedback.
      </p>
      {error && (
        <p className="erp-error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={(event) => void save(event)}>
        <div className="erp-portal-form">
          <label>
            Class
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              required
            >
              {data.classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.grade} · {row.section}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={60}
              required
            />
          </label>
          <label>
            Assessment name
            <input
              value={exam}
              onChange={(event) => setExam(event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label>
            Assessment date
            <input
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              max={date}
              required
            />
          </label>
          <label>
            Maximum marks (all saved rows)
            <input
              type="number"
              value={maximum}
              onChange={(event) => setMaximum(event.target.value)}
              min={1}
              max={1000}
              step="0.5"
              required
            />
          </label>
        </div>
        <div className="erp-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Marks</th>
                <th>Individual feedback</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody
              key={`${classId}:${subject}:${exam}:${day}:${data.assessments.map((row) => row.version).join(',')}`}
            >
              {learners.slice(0, 200).map((row) => {
                const result = existing(row.id);
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small className="erp-table-note">Roll {row.roll}</small>
                    </td>
                    <td>
                      <input
                        aria-label={`Marks for ${row.name}`}
                        name={`score-${row.id}`}
                        type="number"
                        min={0}
                        max={Number(maximum) || 1000}
                        step="0.5"
                        defaultValue={result?.score ?? ''}
                        disabled={busy || Boolean(result?.published)}
                      />
                    </td>
                    <td>
                      <textarea
                        aria-label={`Feedback for ${row.name}`}
                        name={`feedback-${row.id}`}
                        maxLength={1000}
                        defaultValue={result?.feedback ?? ''}
                        disabled={busy || Boolean(result?.published)}
                      />
                    </td>
                    <td>
                      {result && (
                        <small className="erp-table-note">
                          Previously out of {result.maximum}
                        </small>
                      )}
                      <span className="erp-status">
                        {result?.published
                          ? 'Published · locked'
                          : result
                            ? 'Draft'
                            : 'Not entered'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="erp-actions">
          <button className="erp-primary" disabled={busy || !learners.length}>
            <ClipboardCheck size={15} />
            Save draft marks
          </button>
          <span className="erp-directory-help">
            Up to 200 learners per save. Parents see results only after the
            principal publishes them.
          </span>
        </div>
      </form>
    </div>
  );
}
