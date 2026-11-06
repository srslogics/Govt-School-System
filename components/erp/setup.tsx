'use client';

import {
  useEffect,
  useState,
  type SubmitEvent as ReactSubmitEvent,
} from 'react';
import type { Setup } from '@/lib/erp/model';
import { errorMessage, request } from './client';

export function SetupPanel({
  date,
  onSaved,
}: {
  date: string;
  onSaved: () => void;
}) {
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
      action === 'assign' && submitter instanceof HTMLButtonElement
        ? submitter.value
        : action;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setSetup(
        await request<Setup>('setup', { ...data, action: actualAction }),
      );
      if (action !== 'assign') form.reset();
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
          <h2>School setup</h2>
          <p>Use fictional schools, students and staff for this pilot.</p>
        </div>
      </header>
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      <div className="erp-setup-grid">
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
        <form onSubmit={(event) => void submit(event, 'staff')}>
          <h3>Create staff account</h3>
          <label>
            Staff name
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
            </select>
          </label>
          <button className="erp-primary" disabled={busy}>
            Create account
          </button>
        </form>
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
                  ['teacher', 'principal', 'officer'].includes(account.role),
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
        <section className="erp-config-summary">
          <h3>Saved configuration</h3>
          {setup.schools.map((school) => (
            <p key={school.id}>
              <strong>{school.code}</strong> · {school.name}
            </p>
          ))}
          <p>
            {setup.classes.length} classes · {setup.enrolments.length} enrolled
            learners
          </p>
          <ul>
            {setup.assignments.map((entry) => (
              <li key={`${entry.accountId}:${entry.targetId}`}>
                {
                  setup.staff.find((account) => account.id === entry.accountId)
                    ?.name
                }{' '}
                ·{' '}
                {setup.schools.find((school) => school.id === entry.targetId)
                  ?.name ?? classLabel(entry.targetId)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
