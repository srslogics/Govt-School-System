import type { InStatement } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import { type Account, type Counts, type School, todayInNagpur } from './model';
import { ErpError, missing, requiredText } from './validation';

export type EducationRecord = {
  id: string;
  schoolId: string;
  kind: 'inspection' | 'request' | 'circular';
  status: string;
  data: Record<string, string>;
  author: string;
  authorId: string;
  at: string;
  version: number;
};
export type SchoolSummary = School & {
  enrolled: number;
  classes: number;
  staff: number;
  teachers: number;
  attendance: Counts;
  assessed: number;
  published: number;
  average: number | null;
  grants: number;
  expenses: number;
  inventoryItems: number;
  zeroStock: number;
};
export type OversightView = {
  date: string;
  schools: SchoolSummary[];
  classes: {
    id: string;
    schoolId: string;
    grade: string;
    section: string;
    enrolled: number;
    status: string;
    teachers: number;
  }[];
  records: EducationRecord[];
  history: {
    id: string;
    targetId: string;
    actor: string;
    action: string;
    note: string;
    at: string;
  }[];
};
type Stored = Omit<EducationRecord, 'data'> & { data: string };
const columns =
  'SELECT r.id,r.school_id AS schoolId,r.kind,r.status,r.data,r.author_id AS authorId,a.name AS author,r.happened_at AS at,r.version FROM education_record r JOIN account a ON a.id=r.author_id';
function allow(account: Account) {
  if (!['principal', 'officer', 'commissioner'].includes(account.role))
    throw new ErpError(
      403,
      'School oversight is available to assigned principals, education officers and the Commissioner.',
    );
}
function date(value: unknown, label: string) {
  const day = requiredText(value, label, 10),
    parsed = new Date(day + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== day
  )
    throw new ErpError(400, `Choose a valid ${label.toLowerCase()}.`);
  return day;
}
function choice(value: unknown, choices: string[], label: string) {
  const text = requiredText(value, label);
  if (!choices.includes(text))
    throw new ErpError(400, `Choose a valid ${label.toLowerCase()}.`);
  return text;
}
export async function readOversight(
  db: Query,
  account: Account,
  day: string,
): Promise<OversightView> {
  allow(account);
  const schools = (await workspace(db, account)).schools;
  const result: OversightView = {
    date: day,
    schools: [],
    classes: [],
    records: [],
    history: [],
  };
  if (!schools.length) return result;
  const ids = schools.map((s) => s.id),
    slots = ids.map(() => '?').join(',');
  // Aggregate each data set across the assigned schools without transferring individual pupil or payroll records.
  const classes = await many<{
    id: string;
    schoolId: string;
    grade: string;
    section: string;
    enrolled: number;
    status: string;
    teachers: number;
    present: number;
    absent: number;
    leave: number;
    marks: number;
  }>(
    db,
    `
    SELECT c.id,c.school_id AS schoolId,c.grade,c.section,
    (SELECT COUNT(*) FROM enrolment e WHERE e.class_id=c.id AND e.effective_on<=?) AS enrolled,
    COALESCE(r.status,'not submitted') AS status,
    (SELECT COUNT(DISTINCT ca.account_id) FROM class_assignment ca JOIN account a ON a.id=ca.account_id WHERE ca.class_id=c.id AND a.role='teacher') AS teachers,
    CASE WHEN r.status IN ('submitted','reviewed') THEN (SELECT COUNT(*) FROM json_each(r.entries) WHERE json_extract(value,'$.mark')='present') ELSE 0 END AS present,
    CASE WHEN r.status IN ('submitted','reviewed') THEN (SELECT COUNT(*) FROM json_each(r.entries) WHERE json_extract(value,'$.mark')='absent') ELSE 0 END AS absent,
    CASE WHEN r.status IN ('submitted','reviewed') THEN (SELECT COUNT(*) FROM json_each(r.entries) WHERE json_extract(value,'$.mark')='leave') ELSE 0 END AS leave,
    CASE WHEN r.status IN ('submitted','reviewed') THEN json_array_length(r.entries) ELSE 0 END AS marks
    FROM class_section c LEFT JOIN register r ON r.class_id=c.id AND r.day=? WHERE c.school_id IN (${slots}) AND c.effective_on<=? ORDER BY c.grade,c.section`,
    day,
    day,
    ...ids,
    day,
  );
  result.classes = classes.map(
    ({
      present: _present,
      absent: _absent,
      leave: _leave,
      marks: _marks,
      ...row
    }) => ({
      ...row,
      status:
        row.enrolled || row.status !== 'not submitted'
          ? row.status
          : 'no enrolment',
    }),
  );
  const staff = await many<{
    schoolId: string;
    staff: number;
    teachers: number;
  }>(
    db,
    `SELECT schoolId,COUNT(DISTINCT id) AS staff,COUNT(DISTINCT CASE WHEN role='teacher' THEN id END) AS teachers FROM (
    SELECT sa.school_id AS schoolId,a.id,a.role FROM account a JOIN school_assignment sa ON sa.account_id=a.id WHERE sa.school_id IN (${slots}) AND a.role IN ('teacher','principal','clerk','accountant','librarian','support')
    UNION SELECT c.school_id AS schoolId,a.id,a.role FROM account a JOIN class_assignment ca ON ca.account_id=a.id JOIN class_section c ON c.id=ca.class_id WHERE c.school_id IN (${slots}) AND a.role='teacher') GROUP BY schoolId`,
    ...ids,
    ...ids,
  );
  const academics = await many<{
    schoolId: string;
    assessed: number;
    published: number;
    average: number;
  }>(
    db,
    `SELECT c.school_id AS schoolId,COUNT(DISTINCT a.student_id) AS assessed,COUNT(*) AS published,AVG(100.0*a.score/a.maximum) AS average FROM assessment a JOIN enrolment e ON e.id=a.student_id JOIN class_section c ON c.id=e.class_id WHERE c.school_id IN (${slots}) AND a.published=1 AND a.day<=? AND e.effective_on<=? AND c.effective_on<=? GROUP BY c.school_id`,
    ...ids,
    day,
    day,
    day,
  );
  const finance = await many<{
    schoolId: string;
    grants: number;
    expenses: number;
  }>(
    db,
    `SELECT school_id AS schoolId,SUM(CASE WHEN kind='grant' THEN json_extract(data,'$.amount') ELSE 0 END) AS grants,SUM(CASE WHEN kind='expense' THEN json_extract(data,'$.amount') ELSE 0 END) AS expenses FROM school_operation WHERE school_id IN (${slots}) AND kind IN ('grant','expense') AND json_extract(data,'$.day')<=? GROUP BY school_id`,
    ...ids,
    day,
  );
  const stock = await many<{
    schoolId: string;
    inventoryItems: number;
    zeroStock: number;
  }>(
    db,
    `SELECT schoolId,COUNT(*) AS inventoryItems,SUM(CASE WHEN balance=0 THEN 1 ELSE 0 END) AS zeroStock FROM (SELECT i.school_id AS schoolId,CAST(json_extract(i.data,'$.quantity') AS INTEGER)+COALESCE((SELECT SUM(CASE WHEN json_extract(m.data,'$.direction')='receive' THEN json_extract(m.data,'$.quantity') ELSE -json_extract(m.data,'$.quantity') END) FROM school_operation m WHERE m.school_id=i.school_id AND m.kind='movement' AND json_extract(m.data,'$.itemId')=i.id),0) AS balance FROM school_operation i WHERE i.school_id IN (${slots}) AND i.kind='inventory') GROUP BY schoolId`,
    ...ids,
  );
  result.schools = schools.map((school) => {
    const own = classes.filter((c) => c.schoolId === school.id),
      attendance: Counts = {
        expected: 0,
        submitted: 0,
        reviewed: 0,
        returned: 0,
        missing: 0,
        present: 0,
        absent: 0,
        leave: 0,
        total: 0,
      };
    for (const row of own) {
      if (row.enrolled || row.status !== 'not submitted') {
        attendance.expected++;
        if (row.status === 'not submitted') attendance.missing++;
        else attendance[row.status as 'submitted' | 'reviewed' | 'returned']++;
      }
      attendance.present += row.present;
      attendance.absent += row.absent;
      attendance.leave += row.leave;
      attendance.total += row.marks;
    }
    const team = staff.find((r) => r.schoolId === school.id),
      learning = academics.find((r) => r.schoolId === school.id),
      funds = finance.find((r) => r.schoolId === school.id),
      items = stock.find((r) => r.schoolId === school.id);
    return {
      ...school,
      enrolled: own.reduce((sum, c) => sum + c.enrolled, 0),
      classes: own.length,
      staff: team?.staff ?? 0,
      teachers: team?.teachers ?? 0,
      attendance,
      assessed: learning?.assessed ?? 0,
      published: learning?.published ?? 0,
      average: learning?.average ?? null,
      grants: funds?.grants ?? 0,
      expenses: funds?.expenses ?? 0,
      inventoryItems: items?.inventoryItems ?? 0,
      zeroStock: items?.zeroStock ?? 0,
    };
  });
  result.records = (
    await many<Stored>(
      db,
      `${columns} WHERE r.school_id IN (${slots}) ORDER BY r.happened_at DESC,r.id`,
      ...ids,
    )
  ).map((row) => ({
    ...row,
    data: JSON.parse(row.data) as Record<string, string>,
  }));
  result.history = await many(
    db,
    `SELECT h.id,h.target_id AS targetId,a.name AS actor,h.action,h.note,h.happened_at AS at FROM school_activity h JOIN education_record r ON r.id=h.target_id JOIN account a ON a.id=h.actor_id WHERE r.school_id IN (${slots}) AND h.action LIKE 'oversight %' ORDER BY h.happened_at DESC`,
    ...ids,
  );
  return result;
}
export async function updateOversight(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  allow(account);
  return write(db, async (tx) => {
    const scope = (await workspace(tx, account)).schools,
      schoolId = requiredText(body.schoolId, 'School');
    if (!scope.some((s) => s.id === schoolId)) missing();
    const action = requiredText(body.action, 'Action'),
      id = typeof body.id === 'string' && body.id ? body.id : randomUUID();
    const before = body.id
      ? await one<Stored>(
          tx,
          `${columns} WHERE r.id=? AND r.school_id=?`,
          id,
          schoolId,
        )
      : undefined;
    if (body.id && !before) missing();
    if (before && body.version !== before.version)
      throw new ErpError(409, 'This record changed. Refresh before saving.');
    const previous = before
      ? (JSON.parse(before.data) as Record<string, string>)
      : undefined;
    const officer =
      account.role === 'officer' || account.role === 'commissioner';
    const onlyOfficer = () => {
      if (!officer)
        throw new ErpError(
          403,
          'Only education officers or the Commissioner can perform this action.',
        );
    };
    const onlyPrincipal = () => {
      if (account.role !== 'principal')
        throw new ErpError(
          403,
          'Only the school principal can perform this action.',
        );
    };
    const newRecord = () => {
      if (before)
        throw new ErpError(409, 'Create a new record for this action.');
    };
    const existing = (kind: EducationRecord['kind'], statuses: string[]) => {
      if (!before || before.kind !== kind) missing();
      if (!statuses.includes(before.status))
        throw new ErpError(
          409,
          'This action is not available in the current status.',
        );
    };
    let kind: EducationRecord['kind'],
      status: string,
      data: Record<string, string>;
    let note = '';
    if (action === 'inspection') {
      onlyOfficer();
      newRecord();
      kind = 'inspection';
      status = 'planned';
      data = {
        title: requiredText(body.title, 'Visit purpose'),
        visitDate: date(body.visitDate, 'Visit date'),
        note: requiredText(body.note, 'Inspection plan', 2000),
      };
      note = data.note;
    } else if (action === 'findings') {
      onlyOfficer();
      existing('inspection', ['planned']);
      kind = 'inspection';
      status = 'visited';
      const visitedOn = date(body.visitedOn, 'Actual visit date');
      if (visitedOn > todayInNagpur())
        throw new ErpError(
          400,
          'Actual visits cannot be recorded in the future.',
        );
      const due = date(body.due, 'Corrective action deadline');
      if (due < visitedOn)
        throw new ErpError(400, 'Deadline must be on or after the visit.');
      note = requiredText(body.note, 'Inspection findings', 2000);
      data = {
        ...previous!,
        findings: note,
        visitedOn,
        due,
        requiredAction: requiredText(
          body.requiredAction,
          'Corrective action',
          2000,
        ),
      };
    } else if (action === 'inspection-response') {
      onlyPrincipal();
      existing('inspection', ['visited']);
      kind = 'inspection';
      status = 'responded';
      note = requiredText(body.note, 'School corrective-action report', 2000);
      data = { ...previous!, response: note };
    } else if (action === 'inspection-decision') {
      onlyOfficer();
      existing('inspection', ['responded']);
      kind = 'inspection';
      status = choice(
        body.status,
        ['closed', 'visited'],
        'Inspection decision',
      );
      note = requiredText(body.note, 'Verification remarks', 2000);
      data = { ...previous!, verification: note };
    } else if (action === 'request') {
      onlyPrincipal();
      newRecord();
      kind = 'request';
      status = 'submitted';
      note = requiredText(body.note, 'School request details', 2000);
      data = {
        title: requiredText(body.title, 'Request title'),
        category: choice(
          body.category,
          ['general', 'staffing', 'academics', 'funding', 'maintenance'],
          'Category',
        ),
        priority: choice(body.priority, ['normal', 'high'], 'Priority'),
        note,
      };
    } else if (action === 'review-request') {
      onlyOfficer();
      existing('request', ['submitted']);
      kind = 'request';
      status = 'under-review';
      note = requiredText(body.note, 'Officer review', 2000);
      data = { ...previous!, review: note };
    } else if (action === 'request-decision') {
      onlyOfficer();
      existing(
        'request',
        account.role === 'commissioner'
          ? ['under-review', 'escalated']
          : ['under-review'],
      );
      kind = 'request';
      status = choice(
        body.status,
        account.role === 'commissioner'
          ? ['resolved', 'returned', 'declined']
          : ['resolved', 'returned', 'declined', 'escalated'],
        'Request outcome',
      );
      note = requiredText(body.note, 'Decision remarks', 2000);
      data = { ...previous!, decision: note };
    } else if (action === 'resubmit-request') {
      onlyPrincipal();
      existing('request', ['returned']);
      kind = 'request';
      status = 'submitted';
      note = requiredText(body.note, 'Resubmission details', 2000);
      data = { ...previous!, resubmission: note };
    } else if (action === 'circular') {
      onlyOfficer();
      newRecord();
      kind = 'circular';
      status = 'issued';
      const due = date(body.due, 'Compliance deadline');
      if (due < todayInNagpur())
        throw new ErpError(
          400,
          'New circular deadlines cannot be in the past.',
        );
      note = requiredText(body.note, 'Circular instructions', 2000);
      data = { title: requiredText(body.title, 'Circular title'), due, note };
    } else if (action === 'acknowledge') {
      onlyPrincipal();
      existing('circular', ['issued']);
      kind = 'circular';
      status = 'acknowledged';
      note = requiredText(body.note, 'Acknowledgement note', 2000);
      data = { ...previous!, acknowledgement: note };
    } else if (action === 'compliance') {
      onlyPrincipal();
      existing('circular', ['acknowledged']);
      kind = 'circular';
      status = 'reported';
      note = requiredText(body.note, 'Compliance report', 2000);
      data = { ...previous!, compliance: note };
    } else if (action === 'verify-compliance') {
      onlyOfficer();
      existing('circular', ['reported']);
      kind = 'circular';
      status = choice(
        body.status,
        ['closed', 'acknowledged'],
        'Compliance decision',
      );
      note = requiredText(body.note, 'Verification remarks', 2000);
      data = { ...previous!, verification: note };
    } else throw new ErpError(400, 'Unknown oversight action.');
    data = {
      ...data,
      updatedBy: account.name,
      updatedAt: new Date().toISOString(),
    };
    if (action === 'circular' && body.schoolIds !== undefined) {
      if (
        !Array.isArray(body.schoolIds) ||
        !body.schoolIds.length ||
        body.schoolIds.length > 100 ||
        body.schoolIds.some((value) => typeof value !== 'string')
      )
        throw new ErpError(
          400,
          'Choose between 1 and 100 assigned recipient schools.',
        );
      const targets = [...new Set(body.schoolIds as string[])];
      if (targets.some((target) => !scope.some((s) => s.id === target)))
        missing();
      if (!targets.includes(schoolId))
        throw new ErpError(
          400,
          'Include the selected school among circular recipients.',
        );
      const at = new Date().toISOString(),
        statements: InStatement[] = [];
      for (const target of targets) {
        const targetId = target === schoolId ? id : randomUUID();
        statements.push(
          {
            sql: 'INSERT INTO education_record VALUES (?,?,?,?,?,?,?,1)',
            args: [
              targetId,
              target,
              kind,
              status,
              JSON.stringify({ ...data, batchId: id }),
              account.id,
              at,
            ],
          },
          {
            sql: 'INSERT INTO school_activity VALUES (?,?,?,?,?,?,?)',
            args: [
              randomUUID(),
              target,
              account.id,
              targetId,
              'oversight circular',
              JSON.stringify({
                note,
                before: 'new',
                after: status,
                version: 1,
              }),
              at,
            ],
          },
        );
      }
      await tx.batch(statements);
      return { ok: true, id, recipients: targets.length };
    }
    if (before)
      await run(
        tx,
        'UPDATE education_record SET status=?,data=?,version=version+1 WHERE id=?',
        status,
        JSON.stringify(data),
        id,
      );
    else
      await run(
        tx,
        'INSERT INTO education_record VALUES (?,?,?,?,?,?,?,1)',
        id,
        schoolId,
        kind,
        status,
        JSON.stringify(data),
        account.id,
        new Date().toISOString(),
      );
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?,?,?,?,?,?,?)',
      randomUUID(),
      schoolId,
      account.id,
      id,
      'oversight ' + action,
      JSON.stringify({
        note,
        before: before?.status ?? 'new',
        after: status,
        version: (before?.version ?? 0) + 1,
      }),
      new Date().toISOString(),
    );
    return { ok: true, id };
  });
}
