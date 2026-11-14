'use client';

import { useEffect, useState } from 'react';
import type { Report, SchoolPortal, Workspace } from '@/lib/erp/model';
import { attendanceRate, roleLabels } from '@/lib/erp/model';
import type { MaintenanceView } from '@/lib/erp/maintenance';
import type { OperationsView } from '@/lib/erp/operations';
import type { TeacherView } from '@/lib/erp/teacher';
import { errorMessage, request } from './client';

export function PrincipalPanel({
  workspace,
  date,
  portal,
  view,
  onNavigate,
  onOpenRegister,
  onOpenReport,
}: {
  workspace: Workspace;
  date: string;
  portal: SchoolPortal;
  view: string;
  onNavigate: (view: string) => void;
  onOpenRegister?: (id: string) => void;
  onOpenReport?: () => void;
}) {
  const [maintenance, setMaintenance] = useState<MaintenanceView>();
  const [operations, setOperations] = useState<OperationsView>();
  const [report, setReport] = useState<Report>();
  const [teaching, setTeaching] = useState<TeacherView>();
  const [error, setError] = useState('');
  const [school, setSchool] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      request<MaintenanceView>('maintenance', undefined, controller.signal),
      request<OperationsView>('operations', undefined, controller.signal),
      request<Report>(
        `report?date=${encodeURIComponent(date)}`,
        undefined,
        controller.signal,
      ),
      request<TeacherView>(
        `teacher?date=${encodeURIComponent(date)}`,
        undefined,
        controller.signal,
      ),
    ])
      .then(([schoolMaintenance, schoolOperations, attendance, learning]) => {
        if (!controller.signal.aborted) {
          setMaintenance(schoolMaintenance);
          setOperations(schoolOperations);
          setReport(attendance);
          setTeaching(learning);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, [date]);
  if (error)
    return (
      <p role="alert" className="erp-error">
        {error}
      </p>
    );
  if (!report || !teaching)
    return <output>Loading school leadership overview…</output>;
  const schools = report.schools.filter(
    (row) => !school || row.school.id === school,
  );
  const classes = teaching.classes.filter(
    (row) => !school || row.schoolId === school,
  );
  const classIds = new Set(classes.map((row) => row.id));
  const results = teaching.assessments.filter((row) =>
    classIds.has(row.classId),
  );
  const published = results.filter((row) => row.published);
  const drafts = results.length - published.length;
  const tasks = portal.tasks.filter(
    (row) => (!school || row.schoolId === school) && row.status === 'open',
  );
  const requests = portal.requests.filter(
    (row) => (!school || row.schoolId === school) && row.status === 'open',
  );
  const staff = portal.staff
    .filter((row) => !school || row.schoolId === school)
    .filter(
      (row, index, rows) =>
        rows.findIndex((other) => other.id === row.id) === index,
    );
  const coverage = schools.flatMap((row) => row.classes ?? []);
  const count = (key: keyof Report['totals']) =>
    schools.reduce((sum, row) => sum + row.totals[key], 0);
  const reported = count('submitted') + count('reviewed');
  const attendance = {
    ...report.totals,
    total: count('total'),
    present: count('present'),
  };
  const weekday = new Date(date + 'T12:00:00+05:30').getUTCDay() || 7;
  const periods = teaching.lessons.filter(
    (row) => classIds.has(row.classId) && row.weekday === weekday,
  );
  return (
    <div className="erp-principal">
      <div className="erp-portal-section-heading">
        <div>
          <h3>
            {view === 'staff'
              ? 'Staff & responsibilities'
              : view === 'performance'
                ? 'School academic performance'
                : 'School dashboard'}
          </h3>
          <p>
            {date} ·{' '}
            {school
              ? workspace.schools.find((row) => row.id === school)?.name
              : 'All assigned schools'}
          </p>
        </div>
        <label>
          Dashboard school
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
      </div>
      {view === 'overview' && (
        <>
          <section
            className="erp-principal-attendance"
            aria-label="Brief attendance summary"
          >
            <div>
              <span className="erp-eyebrow">ATTENDANCE AT A GLANCE</span>
              <h3>
                {attendanceRate(attendance)}{' '}
                <small>present among reported learners</small>
              </h3>
              <p>
                {count('present')} present · {count('absent')} absent ·{' '}
                {count('leave')} on leave · {reported}/{count('expected')}{' '}
                registers received
              </p>
              <small>
                Missing and returned registers are excluded from the attendance
                rate.
              </small>
            </div>
            <button type="button" onClick={onOpenReport}>
              Full attendance report
            </button>
          </section>
          <div className="erp-portal-metrics">
            <div>
              <strong>
                {coverage.reduce((sum, row) => sum + row.enrolled, 0)}
              </strong>
              <span>Learners on attendance rosters</span>
            </div>
            <div>
              <strong>{staff.length}</strong>
              <span>Assigned staff accounts</span>
            </div>
            <div>
              <strong>{classes.length}</strong>
              <span>Classes in scope</span>
            </div>
            <div>
              <strong>{periods.length}</strong>
              <span>Scheduled periods on this weekday</span>
            </div>
          </div>
          <div className="erp-principal-grid">
            <section className="erp-principal-box">
              <h3>Needs your attention</h3>
              <button type="button" onClick={onOpenReport}>
                <span>Registers awaiting review</span>
                <strong>{count('submitted')}</strong>
              </button>
              <button type="button" onClick={onOpenReport}>
                <span>Missing or returned registers</span>
                <strong>{count('missing') + count('returned')}</strong>
              </button>
              <button type="button" onClick={() => onNavigate('learning')}>
                <span>Draft results to check & publish</span>
                <strong>{drafts}</strong>
              </button>
              <button type="button" onClick={() => onNavigate('requests')}>
                <span>Requests awaiting a school reply</span>
                <strong>{requests.length}</strong>
              </button>
              <button type="button" onClick={() => onNavigate('home')}>
                <span>Open staff tasks</span>
                <strong>{tasks.length}</strong>
              </button>
              {[
                ['leave', 'Pending staff leave', 'pending'],
                ['admission', 'Admissions awaiting decision', 'pending'],
                ['payroll', 'Payroll drafts awaiting approval', 'draft'],
              ].map(([kind, label, status]) => (
                <button
                  type="button"
                  key={kind}
                  onClick={() => onNavigate(`operations-${kind}`)}
                >
                  <span>{label}</span>
                  <strong>
                    {operations?.records.filter(
                      (row) =>
                        (!school || row.schoolId === school) &&
                        row.kind === kind &&
                        row.status === status,
                    ).length ?? 0}
                  </strong>
                </button>
              ))}
              <button
                type="button"
                onClick={() => onNavigate('maintenance-verification')}
              >
                <span>Maintenance completion reports</span>
                <strong>
                  {maintenance?.tickets.filter(
                    (row) =>
                      (!school || row.schoolId === school) &&
                      row.status === 'reported',
                  ).length ?? 0}
                </strong>
              </button>
              <small>
                Result and work counts reflect the records loaded in this pilot;
                they are not an all-time census.
              </small>
            </section>
            <section className="erp-principal-box">
              <h3>Run your school</h3>
              {[
                ['principal-performance', 'Review class performance'],
                ['teacher-students', 'Open student profiles'],
                ['principal-staff', 'View staff & responsibilities'],
                ['teacher-timetable', 'Manage teaching timetable'],
                ['home', 'Assign and follow up staff work'],
                ['operations', 'Open school administration modules'],
                ['notices', 'Publish parent or staff notices'],
              ].map(([id, label]) => (
                <button type="button" key={id} onClick={() => onNavigate(id)}>
                  {label}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </section>
          </div>
          <h3>Class attendance follow-up</h3>
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>School / class</th>
                  <th>Assigned teacher</th>
                  <th>Register status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.classSection.id}>
                    <td>
                      {
                        workspace.schools.find(
                          (item) => item.id === row.classSection.schoolId,
                        )?.name
                      }
                      <br />
                      {row.classSection.grade} · Section{' '}
                      {row.classSection.section}
                    </td>
                    <td>
                      {teaching.teachers
                        .filter((item) => item.classId === row.classSection.id)
                        .map((item) => item.name)
                        .join(', ') || 'No teacher assigned'}
                    </td>
                    <td>{row.status}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onOpenRegister?.(row.classSection.id)}
                      >
                        Open class register
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!coverage.length && <p>No classes are effective on this date.</p>}
          <p className="erp-directory-help">
            Open School administration for staff attendance and leave,
            admissions, payroll preparation, grant expenses, inventory and the
            school calendar. Staff accounts and tasks do not indicate staff
            presence or a complete HR roster.
          </p>
        </>
      )}
      {view === 'staff' && (
        <>
          <p>
            Assigned school accounts, teaching responsibilities and open work.
            This is not a staff attendance register.
          </p>
          <label>
            Find staff
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or role"
            />
          </label>
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Teaching assignments</th>
                  <th>Open tasks</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter((row) =>
                    `${row.name} ${roleLabels[row.role]}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{roleLabels[row.role]}</td>
                      <td>
                        {teaching.teachers
                          .filter(
                            (item) =>
                              item.id === row.id && classIds.has(item.classId),
                          )
                          .map((item) => {
                            const section = classes.find(
                              (c) => c.id === item.classId,
                            );
                            return `${section?.grade} · ${section?.section}`;
                          })
                          .join(', ') || '—'}
                      </td>
                      <td>
                        {
                          tasks.filter((task) => task.assignedTo === row.id)
                            .length
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!staff.length && (
            <p>No staff accounts are assigned in this scope.</p>
          )}
          <button type="button" onClick={() => onNavigate('home')}>
            Assign school work
          </button>
        </>
      )}
      {view === 'performance' && (
        <>
          <p>
            Published results dated on or before {date}. Each result contributes
            its percentage equally; different exams and subjects are combined.
            Showing up to 500 recent result records, not a final report card or
            a class ranking.
          </p>
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Learners assessed</th>
                  <th>Published results</th>
                  <th>Average percentage</th>
                  <th>Below 40% results</th>
                  <th>Draft results</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((section) => {
                  const rows = published.filter(
                    (row) => row.classId === section.id,
                  );
                  const average = rows.length
                    ? `${(rows.reduce((sum, row) => sum + (100 * row.score) / row.maximum, 0) / rows.length).toFixed(1)}%`
                    : '—';
                  return (
                    <tr key={section.id}>
                      <td>
                        {
                          workspace.schools.find(
                            (row) => row.id === section.schoolId,
                          )?.name
                        }
                        <br />
                        {section.grade} · Section {section.section}
                      </td>
                      <td>{new Set(rows.map((row) => row.studentId)).size}</td>
                      <td>{rows.length}</td>
                      <td>{average}</td>
                      <td>
                        {
                          rows.filter((row) => row.score / row.maximum < 0.4)
                            .length
                        }
                      </td>
                      <td>
                        {
                          results.filter(
                            (row) =>
                              row.classId === section.id && !row.published,
                          ).length
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!published.length && (
            <p>No published results in the selected scope yet.</p>
          )}
          <div className="erp-portal-next">
            <button type="button" onClick={() => onNavigate('learning')}>
              Review & publish results
            </button>
            <button
              type="button"
              onClick={() => onNavigate('teacher-students')}
            >
              See individual student profiles
            </button>
          </div>
        </>
      )}
    </div>
  );
}
