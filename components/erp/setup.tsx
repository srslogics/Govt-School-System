'use client';

import {
  useEffect,
  useState,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import { roleLabels, schoolStaffRoles, type Setup } from '@/lib/erp/model';
import { errorMessage, request } from './client';

export function SetupPanel({
  date,
  onSaved,
}: {
  date: string;
  onSaved: () => void;
}) {
  const [section, setSection] = useState('school');
  const [search, setSearch] = useState('');
  const [setup, setSetup] = useState<Setup>();
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    request<Setup>('setup', undefined, controller.signal)
      .then(setSetup)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, []);

  async function submit(
    event: ReactSubmitEvent<HTMLFormElement>,
    action: string,
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const submitter = event.nativeEvent.submitter;
    const actualAction =
      (action === 'assign' || action === 'guardian') &&
      submitter instanceof HTMLButtonElement
        ? submitter.value
        : action;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setSetup(
        await request<Setup>('setup', { ...data, action: actualAction }),
      );
      if (action !== 'assign' && action !== 'guardian') form.reset();
      setMessage('Configuration saved.');
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!setup)
    return error ? (
      <p role="alert" className="erp-error">
        {error}
      </p>
    ) : (
      <output>Loading school setup…</output>
    );
  const staff = setup.staff.find((account) => account.id === staffId);
  const classLabel = (id: string) => {
    const row = setup.classes.find((item) => item.id === id);
    return row
      ? `${setup.schools.find((school) => school.id === row.schoolId)?.code} · ${row.grade} / ${row.section}`
      : id;
  };
  return (
    <section className="erp-card">
      <header className="erp-card-title">
        <div>
          <h2>School directory & setup</h2>
          <p>Keep your school structure and staff assignments organised.</p>
        </div>
      </header>
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      <div className="erp-setup-counts">
        <span>
          <strong>{setup.schools.length}</strong> Schools
        </span>
        <span>
          <strong>{setup.classes.length}</strong> Classes
        </span>
        <span>
          <strong>{setup.enrolments.length}</strong> Learners
        </span>
        <span>
          <strong>{setup.staff.length}</strong> Accounts
        </span>
      </div>
      <nav className="erp-section-tabs" aria-label="Administration sections">
        {[
          ['school', 'Schools'],
          ['class', 'Classes'],
          ['student', 'Students'],
          ['staff', 'People & accounts'],
          ['assign', 'Access assignments'],
          ['guardian', 'Parent links'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={section === id ? 'page' : undefined}
            onClick={() => {
              setSection(id);
              setSearch('');
              setMessage('');
              setError('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="erp-setup-grid">
        {section === 'school' && (
          <form onSubmit={(event) => void submit(event, 'school')}>
            <h3>Add school</h3>
            <label>
              School name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              School code
              <input name="code" required maxLength={24} />
            </label>
            <button className="erp-primary" disabled={busy}>
              Add school
            </button>
          </form>
        )}

        {section === 'class' && (
          <form onSubmit={(event) => void submit(event, 'class')}>
            <h3>Add class and section</h3>
            <label>
              School
              <select name="schoolId" required defaultValue="">
                <option value="" disabled>
                  Choose school
                </option>
                {setup.schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Class
              <input name="grade" required maxLength={32} />
            </label>
            <label>
              Section
              <input name="section" required maxLength={16} />
            </label>
            <label>
              Effective from
              <input
                name="effectiveOn"
                type="date"
                max={date}
                defaultValue={date}
                required
              />
            </label>
            <button className="erp-primary" disabled={busy}>
              Add class
            </button>
          </form>
        )}

        {section === 'student' && (
          <form onSubmit={(event) => void submit(event, 'student')}>
            <h3>Enrol student</h3>
            <label>
              Class and section
              <select name="classId" required defaultValue="">
                <option value="" disabled>
                  Choose class
                </option>
                {setup.classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {classLabel(row.id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Student name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Roll number
              <input name="roll" required maxLength={24} />
            </label>
            <label>
              Effective from
              <input
                name="effectiveOn"
                type="date"
                max={date}
                defaultValue={date}
                required
              />
            </label>
            <button className="erp-primary" disabled={busy}>
              Enrol student
            </button>
          </form>
        )}

        {section === 'staff' && (
          <form onSubmit={(event) => void submit(event, 'staff')}>
            <h3>Create staff or parent account</h3>
            <label>
              Full name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label>
              Role
              <select name="role">
                <option value="teacher">Teacher</option>
                <option value="principal">Principal</option>
                <option value="officer">Education officer</option>
                <option value="parent">Parent / guardian</option>
                <option value="clerk">School office / clerk</option>
                <option value="accountant">Accounts staff</option>
                <option value="librarian">Librarian</option>
                <option value="support">Support staff</option>
              </select>
            </label>
            <button className="erp-primary" disabled={busy}>
              Create account
            </button>
          </form>
        )}

        {section === 'assign' && (
          <form onSubmit={(event) => void submit(event, 'assign')}>
            <h3>Assign staff</h3>
            <label>
              Staff
              <select
                name="accountId"
                required
                value={staffId}
                onChange={(event) => setStaffId(event.target.value)}
              >
                <option value="" disabled>
                  Choose staff member
                </option>
                {setup.staff
                  .filter((account) =>
                    [...schoolStaffRoles, 'officer'].includes(account.role),
                  )
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.role})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {staff?.role === 'teacher' ? 'Class and section' : 'School'}
              <select key={staffId} name="targetId" required defaultValue="">
                <option value="" disabled>
                  Choose assignment
                </option>
                {staff?.role === 'teacher'
                  ? setup.classes.map((row) => (
                      <option key={row.id} value={row.id}>
                        {classLabel(row.id)}
                      </option>
                    ))
                  : setup.schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
              </select>
            </label>
            <div className="erp-actions">
              <button
                className="erp-primary"
                value="assign"
                disabled={busy || !staff}
              >
                Assign
              </button>
              <button value="unassign" disabled={busy || !staff}>
                Remove assignment
              </button>
            </div>
          </form>
        )}

        {section === 'guardian' && (
          <form onSubmit={(event) => void submit(event, 'guardian')}>
            <h3>Link a parent to a child</h3>
            <label>
              Parent account
              <select name="accountId" required defaultValue="">
                <option value="" disabled>
                  Choose parent
                </option>
                {setup.staff
                  .filter((row) => row.role === 'parent')
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.username}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Learner
              <select name="studentId" required defaultValue="">
                <option value="" disabled>
                  Choose learner
                </option>
                {setup.enrolments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {classLabel(row.classId)} · Roll {row.roll}
                  </option>
                ))}
              </select>
            </label>
            <div className="erp-actions">
              <button className="erp-primary" value="guardian" disabled={busy}>
                Link parent
              </button>
              <button value="unguardian" disabled={busy}>
                Remove link
              </button>
            </div>
            <p className="erp-directory-help">
              This grants the parent access only to the selected learner’s
              attendance. Each child must be linked separately.
            </p>
          </form>
        )}
        <section className="erp-config-summary">
          <header className="erp-directory-head">
            <h3>
              {section === 'school'
                ? 'Your schools'
                : section === 'class'
                  ? 'Classes & sections'
                  : section === 'student'
                    ? 'Enrolled learners'
                    : section === 'staff'
                      ? 'Accounts directory'
                      : section === 'guardian'
                        ? 'Linked families'
                        : 'Current assignments'}
            </h3>
            <label>
              <span className="erp-sr-only">Search saved records</span>
              <input
                type="search"
                placeholder="Search records…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </header>
          <div className="erp-directory-list">
            {(section === 'school'
              ? setup.schools.map((row) => ({
                  id: row.id,
                  title: row.name,
                  detail: row.code,
                  badge: `${setup.classes.filter((c) => c.schoolId === row.id).length} classes`,
                }))
              : section === 'class'
                ? setup.classes.map((row) => ({
                    id: row.id,
                    title: classLabel(row.id),
                    detail:
                      setup.schools.find((school) => school.id === row.schoolId)
                        ?.name ?? '',
                    badge: `${setup.enrolments.filter((e) => e.classId === row.id).length} learners`,
                  }))
                : section === 'student'
                  ? setup.enrolments.map((row) => ({
                      id: row.id,
                      title: row.name,
                      detail: classLabel(row.classId),
                      badge: `Roll ${row.roll}`,
                    }))
                  : section === 'staff'
                    ? setup.staff.map((row) => ({
                        id: row.id,
                        title: row.name,
                        detail: row.username,
                        badge: roleLabels[row.role],
                      }))
                    : section === 'guardian'
                      ? setup.guardians.map((row) => ({
                          id: `${row.accountId}:${row.studentId}`,
                          title:
                            setup.staff.find(
                              (account) => account.id === row.accountId,
                            )?.name ?? '',
                          detail:
                            setup.enrolments.find(
                              (student) => student.id === row.studentId,
                            )?.name ?? '',
                          badge: 'Linked child',
                        }))
                      : setup.assignments.map((row) => ({
                          id: `${row.accountId}:${row.targetId}`,
                          title:
                            setup.staff.find((a) => a.id === row.accountId)
                              ?.name ?? '',
                          detail:
                            setup.schools.find(
                              (school) => school.id === row.targetId,
                            )?.name ?? classLabel(row.targetId),
                          badge: 'Assigned',
                        }))
            )
              .filter((row) =>
                `${row.title} ${row.detail} ${row.badge}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((row) => (
                <div className="erp-directory-row" key={row.id}>
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.detail}</small>
                  </span>
                  <span className="erp-tag">{row.badge}</span>
                </div>
              ))}
          </div>
          <p className="erp-directory-help">
            Use fictional records for this pilot. New assignments take effect
            when the staff member refreshes their workspace.
          </p>
        </section>
      </div>
    </section>
  );
}
