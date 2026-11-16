'use client';
import { RecordPreview } from './record-preview';

import { useEffect, useState, type SubmitEvent } from 'react';
import {
  schoolStaffRoles,
  todayInNagpur,
  type Workspace,
} from '@/lib/erp/model';
import type { Operation, OperationsView } from '@/lib/erp/operations';
import { errorMessage, request } from './client';

const modules = [
  ['staff-attendance', 'Staff attendance'],
  ['leave', 'Staff leave'],
  ['admission', 'Admissions'],
  ['payroll', 'Payroll'],
  ['grant', 'Grants & expenses'],
  ['inventory', 'Inventory'],
  ['calendar', 'School calendar'],
] as const;
const department: Record<string, string[]> = {
  clerk: ['admission'],
  accountant: ['payroll', 'grant'],
  librarian: ['inventory'],
  support: ['inventory'],
};
const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Number(value) / 100,
  );
const descriptions: Record<string, string> = {
  'staff-attendance':
    'Record present, absent or on leave for assigned staff. Corrections require a note and retain an audit history. Leave approval does not automatically mark attendance.',
  leave:
    'Staff apply for leave here. A principal records an approval or decline with a reason. An approver cannot decide their own leave.',
  admission:
    'Record an application, then admit with a class roll number and effective date. Approval creates a learner enrolment; parent access must be linked separately by the administrator.',
  payroll:
    'Prepare monthly gross pay and deductions, then approve or decline the draft. Approved means an internally approved salary record, not payment. No bank transfers, tax computation or statutory payroll filing.',
  grant:
    'Record sanctioned allocations and voucher expenses against them. Balances prevent overspending the recorded allocation. These are management records, not bank reconciliation or a statutory accounting ledger.',
  inventory:
    'Maintain item codes, opening stock and receipts/issues with a recipient or purpose. Items cannot be issued below zero. Record returns as receipts. No valuation or depreciation calculation.',
  calendar:
    'Publish all-day holidays, exams, meetings and school activities to staff, parents or both. Events do not automatically change the attendance calendar or teaching timetable.',
};
export function OperationsPanel({
  workspace,
  initialView,
}: {
  workspace: Workspace;
  initialView?: string;
}) {
  const principal = workspace.account.role === 'principal',
    parent = workspace.account.role === 'parent';
  const available = modules.filter(
    ([id]) =>
      principal ||
      id === 'calendar' ||
      (!parent &&
        (['staff-attendance', 'leave'].includes(id) ||
          (department[workspace.account.role] ?? []).includes(id))),
  );
  const [view, setView] = useState<string>(
    initialView && available.some(([id]) => id === initialView)
      ? initialView
      : parent
        ? 'calendar'
        : principal
          ? 'staff-attendance'
          : 'leave',
  );
  const [data, setData] = useState<OperationsView>();
  const [schoolId, setSchoolId] = useState(workspace.schools[0]?.id ?? '');
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const today = todayInNagpur();
  useEffect(() => {
    const controller = new AbortController();
    request<OperationsView>('operations', undefined, controller.signal)
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
    record?: Operation,
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      payload: Record<string, unknown> = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      for (const field of ['gross', 'deductions', 'amount'])
        if (field in payload) {
          const value = String(payload[field]);
          if (!/^\d+(\.\d{1,2})?$/.test(value))
            throw new Error(
              'Enter rupee amounts with no more than two decimal places.',
            );
          const [rupees, paise = ''] = value.split('.');
          payload[field] = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
        }
      if ('quantity' in payload) payload.quantity = Number(payload.quantity);
      await request('operations', {
        ...payload,
        schoolId,
        action,
        ...(record ? { id: record.id, version: record.version } : {}),
      });
      const updated = await request<OperationsView>('operations');
      setData(updated);
      form.reset();
      setMessage(
        action === 'decide'
          ? 'Decision saved.'
          : action === 'staff-attendance'
            ? 'Staff attendance saved.'
            : 'Record saved.',
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  if (
    !principal &&
    !parent &&
    !schoolStaffRoles.includes(workspace.account.role)
  )
    return null;
  const rows = data?.records.filter((row) => row.schoolId === schoolId) ?? [];
  const staff = data?.staff.filter((row) => row.schoolId === schoolId) ?? [];
  const classes =
    data?.classes.filter((row) => row.schoolId === schoolId) ?? [];
  const staffField = (
    <label>
      Staff member
      <select name="staffId" required defaultValue="">
        <option value="" disabled>
          Choose staff
        </option>
        {staff.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
  const dateField = (
    <label>
      Record date
      <input name="day" type="date" required defaultValue={today} max={today} />
    </label>
  );
  const noteField = (
    <label>
      {view === 'inventory'
        ? 'Opening stock note'
        : view === 'payroll'
          ? 'Payroll preparation note'
          : 'Details / purpose'}
      <textarea name="note" required maxLength={1000} />
    </label>
  );
  const canCreate =
    principal ||
    (view === 'leave' && !parent) ||
    (department[workspace.account.role] ?? []).includes(view);
  const mainRows = rows.filter((row) => row.kind === view);
  return (
    <section className="erp-operations">
      <nav
        className="erp-section-tabs"
        aria-label="School administration modules"
      >
        {available.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => {
              setView(id);
              setMessage('');
              setError('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="erp-portal-section-heading">
        <div>
          <h3>{modules.find(([id]) => id === view)?.[1]}</h3>
          <p>{descriptions[view]}</p>
        </div>
        <button type="button" onClick={() => setReload(reload + 1)}>
          Refresh records
        </button>
      </div>
      <label>
        Operations school
        <select
          value={schoolId}
          onChange={(event) => {
            setSchoolId(event.target.value);
            setMessage('');
          }}
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
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data ? (
        <output>Loading school operations…</output>
      ) : (
        <>
          <div className="erp-register-heading">
            <h2>
              {modules.find(([id]) => id === view)?.[1] ?? 'School records'}
            </h2>
            <span>{mainRows.length} records</span>
          </div>
          {canCreate && schoolId && (
            <details
              className="erp-operations-create"
              key={`${view}:${schoolId}`}
            >
              <summary>
                {view === 'staff-attendance'
                  ? 'Mark staff attendance'
                  : view === 'leave'
                    ? 'Apply for leave'
                    : view === 'admission'
                      ? 'New admission application'
                      : view === 'payroll'
                        ? 'Prepare payroll record'
                        : view === 'grant'
                          ? 'Record sanctioned grant'
                          : view === 'inventory'
                            ? 'Add inventory item'
                            : 'Schedule school event'}
              </summary>
              <form
                className="erp-portal-form"
                onSubmit={(event) => void save(event, view)}
              >
                {['staff-attendance', 'payroll'].includes(view) && staffField}
                {['staff-attendance', 'admission', 'grant'].includes(view) &&
                  dateField}
                {view === 'staff-attendance' && (
                  <label>
                    Attendance status
                    <select name="status">
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="leave">On leave</option>
                    </select>
                  </label>
                )}
                {view === 'leave' && (
                  <>
                    <label>
                      Leave start
                      <input
                        name="start"
                        type="date"
                        required
                        defaultValue={today}
                      />
                    </label>
                    <label>
                      Leave end
                      <input
                        name="end"
                        type="date"
                        required
                        defaultValue={today}
                      />
                    </label>
                    <label>
                      Reason
                      <textarea name="reason" required maxLength={1000} />
                    </label>
                  </>
                )}
                {view === 'admission' && (
                  <>
                    <label>
                      Learner name
                      <input name="name" required maxLength={120} />
                    </label>
                    <label>
                      Guardian name
                      <input name="guardian" required maxLength={120} />
                    </label>
                    <label>
                      Guardian contact
                      <input name="contact" required maxLength={120} />
                    </label>
                    <label>
                      Requested class
                      <select name="classId" required defaultValue="">
                        <option value="" disabled>
                          Choose class
                        </option>
                        {classes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.grade} · Section {row.section}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {view === 'payroll' && (
                  <>
                    <label>
                      Payroll month
                      <input
                        name="month"
                        type="month"
                        required
                        defaultValue={today.slice(0, 7)}
                      />
                    </label>
                    <Amount name="gross" label="Gross pay (₹)" />
                    <Amount name="deductions" label="Deductions (₹)" zero />
                  </>
                )}
                {view === 'grant' && (
                  <>
                    <label>
                      Grant name
                      <input name="title" required maxLength={120} />
                    </label>
                    <label>
                      Sanction reference
                      <input name="reference" required maxLength={120} />
                    </label>
                    <Amount name="amount" label="Sanctioned amount (₹)" />
                  </>
                )}
                {view === 'inventory' && (
                  <>
                    <label>
                      Item name
                      <input name="title" required maxLength={120} />
                    </label>
                    <label>
                      Item code
                      <input name="code" required maxLength={60} />
                    </label>
                    <label>
                      Unit
                      <input
                        name="unit"
                        required
                        maxLength={30}
                        placeholder="pieces, books, kg"
                      />
                    </label>
                    <label>
                      Opening quantity
                      <input
                        name="quantity"
                        type="number"
                        required
                        min={0}
                        max={1000000000}
                        step={1}
                      />
                    </label>
                  </>
                )}
                {view === 'calendar' && (
                  <>
                    <label>
                      Event title
                      <input name="title" required maxLength={120} />
                    </label>
                    <label>
                      Event start
                      <input
                        name="start"
                        type="date"
                        required
                        defaultValue={today}
                      />
                    </label>
                    <label>
                      Event end
                      <input
                        name="end"
                        type="date"
                        required
                        defaultValue={today}
                      />
                    </label>
                    <label>
                      Event category
                      <select name="category">
                        <option value="holiday">Holiday</option>
                        <option value="exam">Examination</option>
                        <option value="meeting">Meeting</option>
                        <option value="activity">School activity</option>
                      </select>
                    </label>
                    <label>
                      Event audience
                      <select name="audience">
                        <option value="all">Parents & staff</option>
                        <option value="parents">Parents only</option>
                        <option value="staff">Staff only</option>
                      </select>
                    </label>
                  </>
                )}
                {view !== 'leave' && noteField}
                <button className="erp-primary" disabled={busy}>
                  Save{' '}
                  {view === 'staff-attendance'
                    ? 'staff attendance'
                    : view === 'leave'
                      ? 'leave request'
                      : view === 'admission'
                        ? 'application'
                        : view === 'payroll'
                          ? 'payroll draft'
                          : view === 'grant'
                            ? 'grant'
                            : view === 'inventory'
                              ? 'inventory item'
                              : 'event'}
                </button>
              </form>
            </details>
          )}
          <RecordPreview className="erp-portal-records" label="School records">
            {[...mainRows]
              .sort((a, b) =>
                view === 'calendar'
                  ? String(a.data.start).localeCompare(String(b.data.start))
                  : 0,
              )
              .map((row) => {
                const d = row.data;
                const movements = rows.filter(
                  (item) =>
                    item.kind === 'movement' && item.data.itemId === row.id,
                );
                const expenses = rows.filter(
                  (item) =>
                    item.kind === 'expense' && item.data.grantId === row.id,
                );
                const spent = expenses.reduce(
                  (sum, item) => sum + Number(item.data.amount),
                  0,
                );
                const stock = movements.reduce(
                  (sum, item) =>
                    sum +
                    (item.data.direction === 'receive' ? 1 : -1) *
                      Number(item.data.quantity),
                  Number(d.quantity),
                );
                return (
                  <article
                    className="erp-portal-record"
                    key={`${row.id}:${row.version}`}
                  >
                    <header>
                      <h3>
                        {String(
                          d.title ?? d.staffName ?? d.name ?? 'School record',
                        )}
                      </h3>
                      <span className={`erp-status erp-${row.status}`}>
                        {row.status}
                      </span>
                    </header>
                    {view === 'staff-attendance' && (
                      <p>
                        {String(d.day)} · {String(d.note)}
                      </p>
                    )}
                    {view === 'leave' && (
                      <p>
                        {String(d.start)} to {String(d.end)} ·{' '}
                        {String(d.reason)}
                      </p>
                    )}
                    {view === 'admission' && (
                      <>
                        <p>
                          {classes.find((item) => item.id === d.classId)?.grade}{' '}
                          · Section{' '}
                          {
                            classes.find((item) => item.id === d.classId)
                              ?.section
                          }{' '}
                          · Application {String(d.day)}
                        </p>
                        <p>
                          Guardian: {String(d.guardian)} · {String(d.contact)}
                        </p>
                        <p>{String(d.note)}</p>
                        {d.studentId && (
                          <p>
                            Enrolled · Roll {String(d.roll)} · Effective{' '}
                            {String(d.effectiveOn)}
                          </p>
                        )}
                      </>
                    )}
                    {view === 'payroll' && (
                      <>
                        <p>Salary month {String(d.month)}</p>
                        <p>
                          Gross {money(d.gross)} · Deductions{' '}
                          {money(d.deductions)} ·{' '}
                          <strong>Net {money(d.net)}</strong>
                        </p>
                        <p>{String(d.note)}</p>
                      </>
                    )}
                    {view === 'grant' && (
                      <>
                        <p>
                          Reference {String(d.reference)} · {String(d.day)}
                        </p>
                        <p>
                          Sanctioned {money(d.amount)} · Recorded expenses{' '}
                          {money(spent)} ·{' '}
                          <strong>
                            Remaining {money(Number(d.amount) - spent)}
                          </strong>
                        </p>
                        <p>{String(d.note)}</p>
                      </>
                    )}
                    {view === 'inventory' && (
                      <>
                        <p>
                          Code {String(d.code)} ·{' '}
                          <strong>
                            Available {stock} {String(d.unit)}
                          </strong>
                        </p>
                        <p>
                          Opening stock {String(d.quantity)} · {String(d.note)}
                        </p>
                      </>
                    )}
                    {view === 'calendar' && (
                      <>
                        <p>
                          {String(d.start)} to {String(d.end)} ·{' '}
                          {String(d.category)} ·{' '}
                          {d.audience === 'all'
                            ? 'Parents & staff'
                            : String(d.audience)}
                        </p>
                        <p>{String(d.note)}</p>
                      </>
                    )}
                    <small>
                      Recorded by {row.author} ·{' '}
                      {new Date(row.at).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}{' '}
                      · Version {row.version}
                    </small>
                    {d.decisionNote && (
                      <blockquote>
                        <strong>
                          {String(d.decidedBy)} ·{' '}
                          {String(d.decidedAt).slice(0, 10)}
                        </strong>
                        {String(d.decisionNote)}
                      </blockquote>
                    )}
                    {principal &&
                      ['leave', 'admission', 'payroll', 'calendar'].includes(
                        view,
                      ) &&
                      ['pending', 'draft', 'scheduled'].includes(row.status) &&
                      !(
                        view === 'leave' && d.staffId === workspace.account.id
                      ) && (
                        <details>
                          <summary>
                            {view === 'calendar'
                              ? 'Cancel event'
                              : 'Record principal decision'}
                          </summary>
                          <form
                            className="erp-portal-form"
                            onSubmit={(event) =>
                              void save(event, 'decide', row)
                            }
                          >
                            <label>
                              Decision
                              <select name="status">
                                {view === 'calendar' ? (
                                  <option value="cancelled">
                                    Cancel event
                                  </option>
                                ) : (
                                  <>
                                    <option
                                      value={
                                        view === 'admission'
                                          ? 'admitted'
                                          : 'approved'
                                      }
                                    >
                                      {view === 'admission'
                                        ? 'Admit learner'
                                        : 'Approve'}
                                    </option>
                                    <option value="declined">Decline</option>
                                  </>
                                )}
                              </select>
                            </label>
                            {view === 'admission' && (
                              <>
                                <label>
                                  Roll number (for admission)
                                  <input name="roll" maxLength={30} />
                                </label>
                                <label>
                                  Enrolment start date (for admission)
                                  <input
                                    name="effectiveOn"
                                    type="date"
                                    defaultValue={today}
                                  />
                                </label>
                              </>
                            )}
                            <label>
                              Decision note
                              <textarea name="note" required maxLength={1000} />
                            </label>
                            <button className="erp-primary" disabled={busy}>
                              Save principal decision
                            </button>
                          </form>
                        </details>
                      )}
                    {principal && view === 'staff-attendance' && (
                      <details>
                        <summary>Correct attendance</summary>
                        <form
                          className="erp-portal-form"
                          onSubmit={(event) =>
                            void save(event, 'staff-attendance', row)
                          }
                        >
                          <input
                            type="hidden"
                            name="staffId"
                            value={String(d.staffId)}
                          />
                          <input
                            type="hidden"
                            name="day"
                            value={String(d.day)}
                          />
                          <label>
                            Corrected attendance status
                            <select name="status" defaultValue={row.status}>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="leave">On leave</option>
                            </select>
                          </label>
                          <label>
                            Correction reason
                            <textarea name="note" required maxLength={1000} />
                          </label>
                          <button disabled={busy}>
                            Save attendance correction
                          </button>
                        </form>
                      </details>
                    )}
                    {canCreate &&
                      view === 'payroll' &&
                      ['draft', 'declined'].includes(row.status) && (
                        <details>
                          <summary>Revise payroll draft</summary>
                          <form
                            className="erp-portal-form"
                            onSubmit={(event) =>
                              void save(event, 'revise-payroll', row)
                            }
                          >
                            <input
                              name="staffId"
                              type="hidden"
                              value={String(d.staffId)}
                            />
                            <input
                              name="month"
                              type="hidden"
                              value={String(d.month)}
                            />
                            <label>
                              Revised gross pay (₹)
                              <input
                                name="gross"
                                type="number"
                                min="0.01"
                                max={10000000}
                                step="any"
                                required
                                defaultValue={Number(d.gross) / 100}
                              />
                            </label>
                            <label>
                              Revised deductions (₹)
                              <input
                                name="deductions"
                                type="number"
                                min="0"
                                max={10000000}
                                step="any"
                                required
                                defaultValue={Number(d.deductions) / 100}
                              />
                            </label>
                            <label>
                              Revision reason
                              <textarea name="note" required maxLength={1000} />
                            </label>
                            <button disabled={busy}>
                              Save revised payroll draft
                            </button>
                          </form>
                        </details>
                      )}
                    {canCreate && view === 'grant' && (
                      <details>
                        <summary>Record grant expense</summary>
                        <form
                          className="erp-portal-form"
                          onSubmit={(event) => void save(event, 'expense')}
                        >
                          <input name="grantId" type="hidden" value={row.id} />
                          {dateField}
                          <Amount name="amount" label="Expense amount (₹)" />
                          <label>
                            Voucher reference
                            <input name="reference" required maxLength={120} />
                          </label>
                          <label>
                            Expense purpose
                            <textarea name="note" required maxLength={1000} />
                          </label>
                          <button disabled={busy}>Save grant expense</button>
                        </form>
                      </details>
                    )}
                    {canCreate && view === 'inventory' && (
                      <details>
                        <summary>Receive or issue stock</summary>
                        <form
                          className="erp-portal-form"
                          onSubmit={(event) => void save(event, 'movement')}
                        >
                          <input type="hidden" name="itemId" value={row.id} />
                          {dateField}
                          <label>
                            Stock movement
                            <select name="direction">
                              <option value="receive">Receive / return</option>
                              <option value="issue">Issue</option>
                            </select>
                          </label>
                          <label>
                            Movement quantity
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={1000000000}
                              step={1}
                              required
                            />
                          </label>
                          <label>
                            Recipient / purpose
                            <textarea name="note" required maxLength={1000} />
                          </label>
                          <button disabled={busy}>Save stock movement</button>
                        </form>
                      </details>
                    )}
                    <details>
                      <summary>Record history</summary>
                      {data.history
                        .filter((item) => item.targetId === row.id)
                        .map((item, index) => (
                          <p key={index}>
                            {new Date(item.at).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                            })}{' '}
                            · {item.actor} · {item.beforeStatus} →{' '}
                            {item.afterStatus}
                          </p>
                        ))}
                    </details>
                    {expenses.length > 0 && (
                      <details>
                        <summary>Expense history ({expenses.length})</summary>
                        {expenses.map((item) => (
                          <p key={item.id}>
                            {String(item.data.day)} ·{' '}
                            {String(item.data.reference)} ·{' '}
                            {money(item.data.amount)} · {String(item.data.note)}{' '}
                            · {item.author}
                          </p>
                        ))}
                      </details>
                    )}
                    {movements.length > 0 && (
                      <details>
                        <summary>Stock history ({movements.length})</summary>
                        {movements.map((item) => (
                          <p key={item.id}>
                            {String(item.data.day)} ·{' '}
                            {String(item.data.direction)}{' '}
                            {String(item.data.quantity)} ·{' '}
                            {String(item.data.note)} · {item.author}
                          </p>
                        ))}
                      </details>
                    )}
                  </article>
                );
              })}
          </RecordPreview>
          {!mainRows.length && (
            <div className="erp-empty-state">
              <h3>
                No {modules.find(([id]) => id === view)?.[1].toLowerCase()}{' '}
                records yet
              </h3>
              <p>
                {canCreate
                  ? 'Use the form above to save the first record.'
                  : 'Saved records available to your account will appear here.'}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Amount({
  name,
  label,
  zero = false,
}: {
  name: string;
  label: string;
  zero?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type="number"
        min={zero ? 0 : 0.01}
        max={10000000}
        step="any"
        required
        defaultValue={zero ? '0' : undefined}
      />
    </label>
  );
}
