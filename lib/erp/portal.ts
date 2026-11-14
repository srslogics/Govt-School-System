import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import {
  schoolStaffRoles,
  type Account,
  type AttendanceEntry,
  type FamilyChild,
  type Notice,
  type SchoolPortal,
  type SchoolRequest,
  type StaffTask,
} from './model';
import { ErpError, missing, requiredText } from './validation';

const managers = ['administrator', 'principal'];
const requestManagers = ['administrator', 'principal', 'clerk'];
const categories = ['leave', 'general', 'finance', 'library', 'maintenance'];
const department: Record<string, string> = {
  accountant: 'finance',
  librarian: 'library',
  support: 'maintenance',
};
function allowed(account: Account) {
  if (
    account.role !== 'administrator' &&
    account.role !== 'parent' &&
    !schoolStaffRoles.includes(account.role)
  )
    throw new ErpError(
      403,
      'This workspace is available to school staff and linked parents.',
    );
}
function canHandle(account: Account, category: string) {
  return (
    requestManagers.includes(account.role) ||
    department[account.role] === category
  );
}
export async function readPortal(
  db: Query,
  account: Account,
  date: string,
): Promise<SchoolPortal> {
  allowed(account);
  const schools = (await workspace(db, account)).schools;
  const ids = schools.map((school) => school.id);
  const result: SchoolPortal = {
    children: [],
    notices: [],
    requests: [],
    tasks: [],
    staff: [],
    directory: [],
  };
  if (!ids.length) return result;
  const placeholders = ids.map(() => '?').join(',');
  result.notices = await many<Notice>(
    db,
    `SELECT n.id, n.school_id AS schoolId, s.name AS schoolName, n.title, n.body, n.audience, a.name AS author, n.happened_at AS at FROM school_notice n JOIN school s ON s.id=n.school_id JOIN account a ON a.id=n.author_id WHERE n.school_id IN (${placeholders}) AND (${managers.includes(account.role) ? '1=1' : "n.audience='all' OR n.audience=?"}) ORDER BY n.happened_at DESC LIMIT 50`,
    ...ids,
    ...(managers.includes(account.role)
      ? []
      : [account.role === 'parent' ? 'parents' : 'staff']),
  );
  const requestScope = requestManagers.includes(account.role)
    ? ''
    : department[account.role]
      ? 'AND (r.account_id=? OR r.category=?)'
      : 'AND r.account_id=?';
  const requestArgs = requestManagers.includes(account.role)
    ? []
    : department[account.role]
      ? [account.id, department[account.role]]
      : [account.id];
  result.requests = await many<SchoolRequest>(
    db,
    `SELECT r.id, r.school_id AS schoolId, s.name AS schoolName, r.account_id AS accountId, a.name AS author, e.name AS studentName, r.category, r.title, r.body, r.status, r.response, r.happened_at AS at, r.version FROM school_request r JOIN school s ON s.id=r.school_id JOIN account a ON a.id=r.account_id LEFT JOIN enrolment e ON e.id=r.enrolment_id WHERE r.school_id IN (${placeholders}) ${requestScope} ORDER BY r.happened_at DESC LIMIT 100`,
    ...ids,
    ...requestArgs,
  );
  if (account.role === 'parent') {
    const children = await many<FamilyChild & { entries: string | null }>(
      db,
      `SELECT e.id, e.name, e.roll, s.id AS schoolId, s.name AS schoolName, c.grade || ' · Section ' || c.section AS classLabel, r.status, r.entries FROM guardian_link g JOIN enrolment e ON e.id=g.enrolment_id JOIN class_section c ON c.id=e.class_id JOIN school s ON s.id=c.school_id LEFT JOIN register r ON r.class_id=c.id AND r.day=? WHERE g.account_id=? AND e.effective_on<=? ORDER BY e.name`,
      date,
      account.id,
      date,
    );
    result.children = children.map(({ entries, ...child }) => ({
      ...child,
      status: child.status ?? 'not submitted',
      mark:
        child.status === 'submitted' || child.status === 'reviewed'
          ? ((JSON.parse(entries ?? '[]') as AttendanceEntry[]).find(
              (entry) => entry.id === child.id,
            )?.mark ?? null)
          : null,
    }));
  } else {
    result.tasks = await many<StaffTask>(
      db,
      `SELECT t.id, t.school_id AS schoolId, s.name AS schoolName, t.assigned_to AS assignedTo, a.name AS assignee, t.title, t.body, t.status, t.note, t.version FROM staff_task t JOIN school s ON s.id=t.school_id JOIN account a ON a.id=t.assigned_to WHERE t.school_id IN (${placeholders}) ${managers.includes(account.role) ? '' : 'AND t.assigned_to=?'} ORDER BY t.status DESC, t.title LIMIT 100`,
      ...ids,
      ...(managers.includes(account.role) ? [] : [account.id]),
    );
    if (managers.includes(account.role))
      result.staff = await many<Account & { schoolId: string }>(
        db,
        `SELECT DISTINCT a.id, a.username, a.name, a.role, sa.school_id AS schoolId FROM account a JOIN school_assignment sa ON sa.account_id=a.id WHERE sa.school_id IN (${placeholders}) AND a.role IN ('clerk','accountant','librarian','support','principal') UNION SELECT DISTINCT a.id, a.username, a.name, a.role, c.school_id AS schoolId FROM account a JOIN class_assignment ca ON ca.account_id=a.id JOIN class_section c ON c.id=ca.class_id WHERE c.school_id IN (${placeholders})`,
        ...ids,
        ...ids,
      );
    if (managers.includes(account.role) || account.role === 'clerk')
      result.directory = await many(
        db,
        `SELECT e.id, e.name, e.roll, s.name AS schoolName, c.grade || ' · Section ' || c.section AS classLabel FROM enrolment e JOIN class_section c ON c.id=e.class_id JOIN school s ON s.id=c.school_id WHERE c.school_id IN (${placeholders}) AND e.effective_on<=? ORDER BY s.name, c.grade, c.section, e.roll LIMIT 200`,
        ...ids,
        date,
      );
  }
  return result;
}

export async function updatePortal(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  allowed(account);
  await write(db, async (tx) => {
    const schoolId = requiredText(body.schoolId, 'School');
    if (
      !(await workspace(tx, account)).schools.some(
        (school) => school.id === schoolId,
      )
    )
      missing();
    let id: string;
    let note = '';
    const action = requiredText(body.action, 'Action');
    if (action === 'notice') {
      if (!managers.includes(account.role))
        throw new ErpError(403, 'Only school leadership can publish notices.');
      const audience = requiredText(body.audience, 'Audience');
      if (!['all', 'parents', 'staff'].includes(audience))
        throw new ErpError(400, 'Choose a notice audience.');
      id = randomUUID();
      await run(
        tx,
        'INSERT INTO school_notice VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        schoolId,
        requiredText(body.title, 'Title', 120),
        requiredText(body.body, 'Notice', 2000),
        audience,
        account.id,
        new Date().toISOString(),
      );
    } else if (action === 'request') {
      const category = requiredText(body.category, 'Category');
      if (
        !categories.includes(category) ||
        (category === 'leave' && account.role !== 'parent')
      )
        throw new ErpError(400, 'Choose an available request category.');
      let studentId: string | null = null;
      if (account.role === 'parent') {
        studentId = requiredText(body.studentId, 'Linked child');
        if (
          !(await one(
            tx,
            `SELECT e.id FROM guardian_link g JOIN enrolment e ON e.id=g.enrolment_id JOIN class_section c ON c.id=e.class_id WHERE g.account_id=? AND e.id=? AND c.school_id=?`,
            account.id,
            studentId,
            schoolId,
          ))
        )
          missing();
      }
      id = randomUUID();
      await run(
        tx,
        "INSERT INTO school_request VALUES (?, ?, ?, ?, ?, ?, ?, 'open', '', ?, 1)",
        id,
        schoolId,
        account.id,
        studentId,
        category,
        requiredText(body.title, 'Subject', 120),
        requiredText(body.body, 'Request details', 2000),
        new Date().toISOString(),
      );
    } else if (action === 'respond') {
      id = requiredText(body.id, 'Request');
      const row = await one<SchoolRequest>(
        tx,
        'SELECT account_id AS accountId, category, version, status FROM school_request WHERE id=? AND school_id=?',
        id,
        schoolId,
      );
      if (!row) missing();
      if (!canHandle(account, row.category) || row.accountId === account.id)
        throw new ErpError(
          403,
          'This request must be handled by authorised school staff other than its author.',
        );
      if (body.version !== row.version || row.status !== 'open')
        throw new ErpError(
          409,
          'This request changed. Refresh before responding.',
        );
      if (body.status !== 'resolved' && body.status !== 'declined')
        throw new ErpError(400, 'Choose resolved or declined.');
      note = requiredText(body.response, 'Response', 1000);
      await run(
        tx,
        'UPDATE school_request SET status=?, response=?, version=version+1 WHERE id=?',
        body.status,
        note,
        id,
      );
    } else if (action === 'task') {
      if (!managers.includes(account.role))
        throw new ErpError(403, 'Only school leadership can assign work.');
      const staffId = requiredText(body.assignedTo, 'Staff member');
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
      id = randomUUID();
      await run(
        tx,
        "INSERT INTO staff_task VALUES (?, ?, ?, ?, ?, 'open', '', 1)",
        id,
        schoolId,
        staffId,
        requiredText(body.title, 'Task', 120),
        requiredText(body.body, 'Task details', 2000),
      );
    } else if (action === 'complete') {
      id = requiredText(body.id, 'Task');
      const task = await one<StaffTask>(
        tx,
        'SELECT assigned_to AS assignedTo, status, version FROM staff_task WHERE id=? AND school_id=?',
        id,
        schoolId,
      );
      if (!task || task.assignedTo !== account.id) missing();
      if (body.version !== task.version || task.status !== 'open')
        throw new ErpError(
          409,
          'This task changed. Refresh before completing it.',
        );
      note = requiredText(body.note, 'Completion note', 1000);
      await run(
        tx,
        "UPDATE staff_task SET status='completed', note=?, version=version+1 WHERE id=?",
        note,
        id,
      );
    } else throw new ErpError(400, 'Unknown school action.');
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
      randomUUID(),
      schoolId,
      account.id,
      id,
      action,
      note,
      new Date().toISOString(),
    );
  });
  return { ok: true };
}
