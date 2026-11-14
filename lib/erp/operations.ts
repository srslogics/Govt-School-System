import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import {
  schoolStaffRoles,
  todayInNagpur,
  type Account,
  type ClassSection,
  type School,
} from './model';
import { ErpError, missing, requiredText } from './validation';

export type OperationKind =
  | 'staff-attendance'
  | 'leave'
  | 'admission'
  | 'payroll'
  | 'grant'
  | 'expense'
  | 'inventory'
  | 'movement'
  | 'calendar';
export type OperationData = Record<string, string | number>;
export type Operation = {
  id: string;
  schoolId: string;
  kind: OperationKind;
  status: string;
  data: OperationData;
  authorId: string;
  author: string;
  at: string;
  version: number;
};
export type OperationsView = {
  history: {
    targetId: string;
    actor: string;
    action: string;
    at: string;
    beforeStatus: string;
    afterStatus: string;
  }[];
  records: Operation[];
  schools: School[];
  classes: ClassSection[];
  staff: (Account & { schoolId: string })[];
};
type Stored = Omit<Operation, 'data'> & { data: string };
const select =
  'SELECT o.id,o.school_id AS schoolId,o.kind,o.status,o.data,o.author_id AS authorId,a.name AS author,o.happened_at AS at,o.version FROM school_operation o JOIN account a ON a.id=o.author_id';
const departments: Record<string, OperationKind[]> = {
  clerk: ['admission'],
  accountant: ['payroll', 'grant', 'expense'],
  librarian: ['inventory', 'movement'],
  support: ['inventory', 'movement'],
};
function permitted(account: Account, kind: OperationKind, data: OperationData) {
  if (account.role === 'principal') return true;
  if (account.role === 'parent')
    return (
      kind === 'calendar' && ['all', 'parents'].includes(String(data.audience))
    );
  if (!schoolStaffRoles.includes(account.role)) return false;
  return (
    (kind === 'calendar' && ['all', 'staff'].includes(String(data.audience))) ||
    (['leave', 'staff-attendance'].includes(kind) &&
      data.staffId === account.id) ||
    (departments[account.role] ?? []).includes(kind)
  );
}
export async function readOperations(
  db: Query,
  account: Account,
): Promise<OperationsView> {
  if (account.role !== 'parent' && !schoolStaffRoles.includes(account.role))
    throw new ErpError(
      403,
      'School operations are available to assigned school staff and linked families.',
    );
  const { schools } = await workspace(db, account);
  const result: OperationsView = {
    history: [],
    records: [],
    schools,
    classes: [],
    staff: [],
  };
  if (!schools.length) return result;
  const ids = schools.map((s) => s.id),
    slots = ids.map(() => '?').join(',');
  // Filter sensitive categories and personal records before returning any rows.
  const kinds =
    account.role === 'principal'
      ? ''
      : account.role === 'parent'
        ? "AND o.kind='calendar' AND json_extract(o.data,'$.audience') IN ('all','parents')"
        : `AND ((o.kind='calendar' AND json_extract(o.data,'$.audience') IN ('all','staff')) OR (o.kind IN ('leave','staff-attendance') AND json_extract(o.data,'$.staffId')=?) ${departments[account.role]?.length ? `OR o.kind IN (${departments[account.role].map((k) => `'${k}'`).join(',')})` : ''})`;
  const rows = await many<Stored>(
    db,
    `${select} WHERE o.school_id IN (${slots}) ${kinds} ORDER BY o.happened_at DESC,o.id DESC`,
    ...ids,
    ...(!['principal', 'parent'].includes(account.role) ? [account.id] : []),
  );
  // Do not truncate balances: grants and inventory depend on their complete movement histories.
  result.records = rows.map((row) => ({
    ...row,
    data: JSON.parse(row.data) as OperationData,
  }));
  const events = await many<{
    targetId: string;
    actor: string;
    action: string;
    at: string;
    note: string;
  }>(
    db,
    `SELECT h.target_id AS targetId,a.name AS actor,h.action,h.happened_at AS at,h.note FROM school_activity h JOIN school_operation o ON o.id=h.target_id JOIN account a ON a.id=h.actor_id WHERE o.school_id IN (${slots}) AND h.action LIKE 'operations %' ${kinds} ORDER BY h.happened_at DESC`,
    ...ids,
    ...(!['principal', 'parent'].includes(account.role) ? [account.id] : []),
  );
  result.history = events.map(({ note, ...event }) => {
    const detail = JSON.parse(note) as {
      before: { status: string } | null;
      after: { status: string };
    };
    return {
      ...event,
      beforeStatus: detail.before?.status ?? 'new',
      afterStatus: detail.after.status,
    };
  });
  if (account.role === 'principal' || account.role === 'clerk')
    result.classes = await many(
      db,
      `SELECT id,school_id AS schoolId,grade,section FROM class_section WHERE school_id IN (${slots}) ORDER BY grade,section`,
      ...ids,
    );
  if (account.role !== 'parent') {
    const staff = await many<Account & { schoolId: string }>(
      db,
      `SELECT DISTINCT a.id,a.name,a.username,a.role,s.school_id AS schoolId FROM account a JOIN school_assignment s ON s.account_id=a.id WHERE s.school_id IN (${slots}) AND a.role IN ('teacher','principal','clerk','accountant','librarian','support') UNION SELECT DISTINCT a.id,a.name,a.username,a.role,c.school_id AS schoolId FROM account a JOIN class_assignment ca ON ca.account_id=a.id JOIN class_section c ON c.id=ca.class_id WHERE c.school_id IN (${slots}) AND a.role='teacher'`,
      ...ids,
      ...ids,
    );
    result.staff =
      account.role === 'principal' || account.role === 'accountant'
        ? staff
        : staff.filter((row) => row.id === account.id);
  }
  return result;
}
function day(value: unknown, label: string, future = true) {
  const date = requiredText(value, label, 10),
    parsed = new Date(date + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== date ||
    (!future && date > todayInNagpur())
  )
    throw new ErpError(
      400,
      `Choose a valid ${label.toLowerCase()}${future ? '' : ' no later than today'}.`,
    );
  return date;
}
function integer(value: unknown, label: string, min = 0) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > 1_000_000_000
  )
    throw new ErpError(
      400,
      `${label} must be a whole number between ${min} and 1,000,000,000.`,
    );
  return value;
}
function choice(value: unknown, values: string[], label: string) {
  const text = requiredText(value, label);
  if (!values.includes(text))
    throw new ErpError(400, `Choose a valid ${label.toLowerCase()}.`);
  return text;
}
function requireRole(account: Account, roles: string[]) {
  if (!roles.includes(account.role))
    throw new ErpError(403, 'Your role cannot perform this school action.');
}
export async function updateOperations(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  if (!schoolStaffRoles.includes(account.role))
    throw new ErpError(
      403,
      'Only assigned school staff can change operations.',
    );
  return write(db, async (tx) => {
    const schoolId = requiredText(body.schoolId, 'School'),
      action = requiredText(body.action, 'Action');
    if (!(await workspace(tx, account)).schools.some((s) => s.id === schoolId))
      missing();
    const id = typeof body.id === 'string' && body.id ? body.id : randomUUID();
    let before: Operation | undefined;
    if (body.id) {
      const stored = await one<Stored>(
        tx,
        `${select} WHERE o.id=? AND o.school_id=?`,
        id,
        schoolId,
      );
      if (!stored) missing();
      before = { ...stored, data: JSON.parse(stored.data) as OperationData };
      if (!permitted(account, before.kind, before.data)) missing();
      if (body.version !== before.version)
        throw new ErpError(409, 'This record changed. Refresh before saving.');
    }
    const ensureNew = () => {
      if (before)
        throw new ErpError(409, 'Create a new record for this action.');
    };
    const staffMember = async (value: unknown) => {
      const staffId = requiredText(value, 'Staff member');
      if (
        !(await one(
          tx,
          `SELECT a.id FROM account a WHERE a.id=? AND a.role IN ('teacher','principal','clerk','accountant','librarian','support') AND (EXISTS(SELECT 1 FROM school_assignment s WHERE s.account_id=a.id AND s.school_id=?) OR EXISTS(SELECT 1 FROM class_assignment ca JOIN class_section c ON c.id=ca.class_id WHERE ca.account_id=a.id AND c.school_id=?))`,
          staffId,
          schoolId,
          schoolId,
        ))
      )
        missing();
      const member = await one<Account>(
        tx,
        'SELECT id,name,username,role FROM account WHERE id=?',
        staffId,
      );
      return { staffId, staffName: member!.name };
    };
    let kind: OperationKind,
      status = 'recorded',
      data: OperationData,
      key = id;
    if (action === 'staff-attendance') {
      requireRole(account, ['principal']);
      if (before && before.kind !== 'staff-attendance') missing();
      kind = 'staff-attendance';
      const member = await staffMember(body.staffId),
        date = day(body.day, 'Attendance date', false);
      if (
        before &&
        (before.data.staffId !== member.staffId || before.data.day !== date)
      )
        throw new ErpError(
          400,
          'Attendance corrections must keep the same staff member and date.',
        );
      status = choice(
        body.status,
        ['present', 'absent', 'leave'],
        'Attendance status',
      );
      data = {
        ...member,
        day: date,
        note: requiredText(body.note, 'Attendance note', 1000),
      };
      key = member.staffId + ':' + date;
    } else if (action === 'leave') {
      ensureNew();
      kind = 'leave';
      status = 'pending';
      const member = await staffMember(account.id),
        start = day(body.start, 'Start date'),
        end = day(body.end, 'End date');
      if (end < start)
        throw new ErpError(400, 'Leave end must be on or after the start.');
      if (
        await one(
          tx,
          `SELECT id FROM school_operation WHERE kind='leave' AND status IN ('pending','approved') AND json_extract(data,'$.staffId')=? AND json_extract(data,'$.start')<=? AND json_extract(data,'$.end')>=?`,
          account.id,
          end,
          start,
        )
      )
        throw new ErpError(
          409,
          'A pending or approved leave request overlaps these dates.',
        );
      data = {
        ...member,
        start,
        end,
        reason: requiredText(body.reason, 'Leave reason', 1000),
      };
    } else if (action === 'admission') {
      requireRole(account, ['principal', 'clerk']);
      ensureNew();
      kind = 'admission';
      status = 'pending';
      const classId = requiredText(body.classId, 'Class');
      if (
        !(await one(
          tx,
          'SELECT id FROM class_section WHERE id=? AND school_id=?',
          classId,
          schoolId,
        ))
      )
        missing();
      data = {
        name: requiredText(body.name, 'Learner name'),
        guardian: requiredText(body.guardian, 'Guardian name'),
        contact: requiredText(body.contact, 'Guardian contact', 120),
        classId,
        day: day(body.day, 'Application date', false),
        note: requiredText(body.note, 'Application note', 1000),
      };
    } else if (action === 'payroll' || action === 'revise-payroll') {
      requireRole(account, ['principal', 'accountant']);
      if (action === 'payroll') ensureNew();
      else if (
        !before ||
        before.kind !== 'payroll' ||
        !['draft', 'declined'].includes(before.status)
      )
        throw new ErpError(
          409,
          'Only draft or declined payroll can be revised.',
        );
      kind = 'payroll';
      status = 'draft';
      const member = await staffMember(body.staffId),
        month = requiredText(body.month, 'Payroll month', 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new ErpError(400, 'Choose a valid payroll month.');
      if (
        before &&
        (before.data.staffId !== member.staffId || before.data.month !== month)
      )
        throw new ErpError(
          400,
          'Payroll revisions must retain the staff member and salary month.',
        );
      const gross = integer(body.gross, 'Gross pay in paise', 1),
        deductions = integer(body.deductions, 'Deductions in paise');
      if (deductions > gross)
        throw new ErpError(400, 'Deductions cannot exceed gross pay.');
      data = {
        ...member,
        month,
        gross,
        deductions,
        net: gross - deductions,
        note: requiredText(body.note, 'Payroll preparation note', 1000),
      };
      key = member.staffId + ':' + month;
    } else if (action === 'grant') {
      requireRole(account, ['principal', 'accountant']);
      ensureNew();
      kind = 'grant';
      data = {
        title: requiredText(body.title, 'Grant name'),
        reference: requiredText(body.reference, 'Sanction reference'),
        amount: integer(body.amount, 'Sanctioned amount in paise', 1),
        day: day(body.day, 'Sanction date', false),
        note: requiredText(body.note, 'Grant purpose', 1000),
      };
      key = String(data.reference).toLowerCase();
    } else if (action === 'expense') {
      requireRole(account, ['principal', 'accountant']);
      ensureNew();
      kind = 'expense';
      const grantId = requiredText(body.grantId, 'Grant');
      const grant = await one<Stored>(
        tx,
        `${select} WHERE o.id=? AND o.school_id=? AND o.kind='grant'`,
        grantId,
        schoolId,
      );
      if (!grant) missing();
      const allocation = JSON.parse(grant.data) as OperationData,
        amount = integer(body.amount, 'Expense in paise', 1);
      const spent = await one<{ total: number }>(
        tx,
        "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) AS total FROM school_operation WHERE school_id=? AND kind='expense' AND json_extract(data,'$.grantId')=?",
        schoolId,
        grantId,
      );
      if (amount + Number(spent?.total) > Number(allocation.amount))
        throw new ErpError(
          409,
          'This expense exceeds the remaining sanctioned grant.',
        );
      const date = day(body.day, 'Expense date', false);
      if (date < String(allocation.day))
        throw new ErpError(400, 'Expense date cannot precede grant sanction.');
      data = {
        grantId,
        title: String(allocation.title),
        amount,
        day: date,
        reference: requiredText(body.reference, 'Voucher reference'),
        note: requiredText(body.note, 'Expense purpose', 1000),
      };
      key = String(data.reference).toLowerCase();
    } else if (action === 'inventory') {
      requireRole(account, ['principal', 'librarian', 'support']);
      ensureNew();
      kind = 'inventory';
      data = {
        title: requiredText(body.title, 'Item name'),
        code: requiredText(body.code, 'Item code', 60),
        unit: requiredText(body.unit, 'Unit', 30),
        quantity: integer(body.quantity, 'Opening quantity'),
        note: requiredText(body.note, 'Opening stock note', 1000),
      };
      key = String(data.code).toLowerCase();
    } else if (action === 'movement') {
      requireRole(account, ['principal', 'librarian', 'support']);
      ensureNew();
      kind = 'movement';
      const itemId = requiredText(body.itemId, 'Inventory item');
      const item = await one<Stored>(
        tx,
        `${select} WHERE o.id=? AND o.school_id=? AND o.kind='inventory'`,
        itemId,
        schoolId,
      );
      if (!item) missing();
      const stock = JSON.parse(item.data) as OperationData,
        direction = choice(body.direction, ['receive', 'issue'], 'Movement'),
        quantity = integer(body.quantity, 'Quantity', 1);
      const previous = await many<{ data: string }>(
        tx,
        "SELECT data FROM school_operation WHERE school_id=? AND kind='movement' AND json_extract(data,'$.itemId')=?",
        schoolId,
        itemId,
      );
      const balance = previous.reduce((sum, row) => {
        const entry = JSON.parse(row.data) as OperationData;
        return (
          sum +
          (entry.direction === 'receive' ? 1 : -1) * Number(entry.quantity)
        );
      }, Number(stock.quantity));
      if (direction === 'issue' && quantity > balance)
        throw new ErpError(409, 'Cannot issue more than the stock available.');
      data = {
        itemId,
        title: String(stock.title),
        direction,
        quantity,
        day: day(body.day, 'Movement date', false),
        note: requiredText(body.note, 'Recipient / stock movement note', 1000),
      };
    } else if (action === 'calendar') {
      requireRole(account, ['principal']);
      ensureNew();
      kind = 'calendar';
      status = 'scheduled';
      const start = day(body.start, 'Event start'),
        end = day(body.end, 'Event end');
      if (end < start)
        throw new ErpError(400, 'Event end must be on or after the start.');
      data = {
        title: requiredText(body.title, 'Event title'),
        start,
        end,
        audience: choice(
          body.audience,
          ['all', 'parents', 'staff'],
          'Audience',
        ),
        category: choice(
          body.category,
          ['holiday', 'exam', 'meeting', 'activity'],
          'Event category',
        ),
        note: requiredText(body.note, 'Event details', 1000),
      };
    } else if (action === 'decide') {
      requireRole(account, ['principal']);
      if (
        !before ||
        !['leave', 'admission', 'payroll', 'calendar'].includes(before.kind)
      )
        missing();
      kind = before.kind;
      data = {
        ...before.data,
        decisionNote: requiredText(body.note, 'Decision note', 1000),
        decidedBy: account.name,
        decidedAt: new Date().toISOString(),
      };
      const expected =
        kind === 'payroll'
          ? 'draft'
          : kind === 'calendar'
            ? 'scheduled'
            : 'pending';
      if (before.status !== expected)
        throw new ErpError(409, 'This record has already been decided.');
      status = choice(
        body.status,
        kind === 'calendar'
          ? ['cancelled']
          : kind === 'admission'
            ? ['admitted', 'declined']
            : ['approved', 'declined'],
        'Decision',
      );
      if (kind === 'leave' && data.staffId === account.id)
        throw new ErpError(
          403,
          'You cannot approve or decline your own leave. Another assigned principal must decide.',
        );
      if (kind === 'admission' && status === 'admitted') {
        const classId = String(data.classId),
          effectiveOn = day(body.effectiveOn, 'Enrolment start date'),
          roll = requiredText(body.roll, 'Roll number', 30);
        const section = await one<{ effective_on: string }>(
          tx,
          'SELECT effective_on FROM class_section WHERE id=? AND school_id=?',
          classId,
          schoolId,
        );
        if (!section) missing();
        if (
          effectiveOn < section.effective_on ||
          effectiveOn < String(data.day)
        )
          throw new ErpError(
            400,
            'Enrolment cannot start before the class or application date.',
          );
        if (
          await one(
            tx,
            'SELECT id FROM enrolment WHERE class_id=? AND roll=?',
            classId,
            roll,
          )
        )
          throw new ErpError(
            409,
            'This roll number is already enrolled in the class.',
          );
        const studentId = randomUUID();
        await run(
          tx,
          'INSERT INTO enrolment VALUES (?,?,?,?,?)',
          studentId,
          classId,
          String(data.name),
          roll,
          effectiveOn,
        );
        data = { ...data, studentId, roll, effectiveOn };
      }
    } else throw new ErpError(400, 'Unknown school operation.');
    const at = new Date().toISOString();
    if (before)
      await run(
        tx,
        'UPDATE school_operation SET status=?,data=?,version=version+1 WHERE id=?',
        status,
        JSON.stringify(data),
        id,
      );
    else {
      if (
        await one(
          tx,
          'SELECT id FROM school_operation WHERE school_id=? AND kind=? AND record_key=?',
          schoolId,
          kind,
          key,
        )
      )
        throw new ErpError(
          409,
          'A record already exists for this staff/date, payroll month or reference. Refresh before correcting it.',
        );
      await run(
        tx,
        'INSERT INTO school_operation VALUES (?,?,?,?,?,?,?,?,1)',
        id,
        schoolId,
        kind,
        key,
        status,
        JSON.stringify(data),
        account.id,
        at,
      );
    }
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?,?,?,?,?,?,?)',
      randomUUID(),
      schoolId,
      account.id,
      id,
      'operations ' + action,
      JSON.stringify({
        before: before
          ? {
              status: before.status,
              data: before.data,
              version: before.version,
            }
          : null,
        after: { kind, status, data, version: (before?.version ?? 0) + 1 },
      }),
      at,
    );
    return { ok: true, id };
  });
}
