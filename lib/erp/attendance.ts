import { randomUUID } from 'node:crypto';
import { many, one, write, run, type Query, type Database } from './database';
import {
  marks,
  todayInNagpur,
  type Account,
  type AttendanceEntry,
  type ClassSection,
  type Counts,
  type Coverage,
  type HistoryEvent,
  type Mark,
  type RegisterStatus,
  type RegisterView,
  type Report,
  type School,
  type Student,
  type Workspace,
} from './model';
import { ErpError, missing, object, requiredText } from './validation';

type StoredRegister = {
  id: string;
  class_id: string;
  status: RegisterStatus;
  version: number;
  entries: string;
};

export async function workspace(
  db: Query,
  account: Account,
): Promise<Workspace> {
  const schools =
    account.role === 'administrator' || account.role === 'commissioner'
      ? await many<School>(
          db,
          'SELECT id, code, name FROM school ORDER BY code',
        )
      : account.role === 'teacher'
        ? await many<School>(
            db,
            `SELECT DISTINCT s.id, s.code, s.name FROM school s
          JOIN class_section c ON c.school_id = s.id JOIN class_assignment a ON a.class_id = c.id
          WHERE a.account_id = ? ORDER BY s.code`,
            account.id,
          )
        : await many<School>(
            db,
            `SELECT s.id, s.code, s.name FROM school s
          JOIN school_assignment a ON a.school_id = s.id WHERE a.account_id = ? ORDER BY s.code`,
            account.id,
          );
  const classes =
    account.role === 'teacher'
      ? await many<ClassSection>(
          db,
          `SELECT c.id, c.school_id AS schoolId, c.grade, c.section FROM class_section c
        JOIN class_assignment a ON a.class_id = c.id WHERE a.account_id = ? ORDER BY c.grade, c.section`,
          account.id,
        )
      : account.role === 'principal'
        ? await many<ClassSection>(
            db,
            `SELECT c.id, c.school_id AS schoolId, c.grade, c.section FROM class_section c
          JOIN school_assignment a ON a.school_id = c.school_id WHERE a.account_id = ? ORDER BY c.grade, c.section`,
            account.id,
          )
        : [];
  return { account, date: todayInNagpur(), schools, classes };
}

async function registerContext(
  db: Query,
  account: Account,
  classId: string,
  date: string,
) {
  if (account.role !== 'teacher' && account.role !== 'principal') missing();
  const assignment =
    account.role === 'teacher'
      ? 'JOIN class_assignment a ON a.class_id = c.id'
      : 'JOIN school_assignment a ON a.school_id = c.school_id';
  const classSection = await one<ClassSection>(
    db,
    `SELECT c.id, c.school_id AS schoolId, c.grade, c.section
    FROM class_section c ${assignment}
    WHERE c.id = ? AND a.account_id = ? AND c.effective_on <= ?`,
    classId,
    account.id,
    date,
  );
  if (!classSection) missing();
  const school = await one<School>(
    db,
    'SELECT id, code, name FROM school WHERE id = ?',
    classSection.schoolId,
  );
  if (!school) missing();
  const register = await one<StoredRegister>(
    db,
    'SELECT * FROM register WHERE class_id = ? AND day = ?',
    classId,
    date,
  );
  const entries = register
    ? (JSON.parse(register.entries) as AttendanceEntry[])
    : [];
  const roster = register
    ? entries.map(({ id, name, roll }) => ({ id, name, roll }))
    : await many<Student>(
        db,
        `SELECT id, name, roll FROM enrolment
        WHERE class_id = ? AND effective_on <= ? ORDER BY roll, name`,
        classId,
        date,
      );
  return { school, classSection, register, entries, roster };
}

export async function getRegister(
  db: Query,
  account: Account,
  classId: string,
  date: string,
): Promise<RegisterView> {
  const { school, classSection, register, entries, roster } =
    await registerContext(db, account, classId, date);
  const history = register
    ? await many<HistoryEvent>(
        db,
        `SELECT actor_name AS actor, action, happened_at AS at,
    note, changed_marks AS changedMarks FROM register_event WHERE register_id = ? ORDER BY version`,
        register.id,
      )
    : [];
  return {
    school,
    classSection,
    date,
    roster,
    history,
    register: register
      ? { status: register.status, version: register.version, entries }
      : null,
  };
}

export async function updateRegister(
  db: Database,
  account: Account,
  classId: string,
  date: string,
  body: Record<string, unknown>,
) {
  await write(db, async (tx) => {
    const {
      register,
      roster,
      entries: previous,
    } = await registerContext(tx, account, classId, date);
    if (body.version !== (register?.version ?? 0))
      throw new ErpError(
        409,
        'This register changed. Reload it before continuing.',
      );
    let action: HistoryEvent['action'];
    let status: RegisterStatus;
    let entries = previous;
    let changed = 0;
    let note = '';
    if (body.action === 'submit' && account.role === 'teacher') {
      if (register && register.status !== 'returned')
        throw new ErpError(
          409,
          'Only a new or returned register can be submitted.',
        );
      if (!roster.length)
        throw new ErpError(
          409,
          'This class has no students enrolled for this date.',
        );
      const values = object(body.marks);
      if (Object.keys(values).length !== roster.length)
        throw new ErpError(400, 'Mark every enrolled student exactly once.');
      entries = roster.map((student) => {
        const mark = values[student.id];
        if (!Object.hasOwn(values, student.id) || !marks.includes(mark as Mark))
          throw new ErpError(
            400,
            'Choose present, absent or on leave for every enrolled student.',
          );
        return { ...student, mark: mark as Mark };
      });
      changed = register
        ? entries.filter((entry, index) => entry.mark !== previous[index]?.mark)
            .length
        : entries.length;
      action = register ? 'resubmitted' : 'submitted';
      status = 'submitted';
      if (register) note = requiredText(body.note, 'Correction note', 500);
    } else if (
      (body.action === 'return' || body.action === 'review') &&
      account.role === 'principal'
    ) {
      if (register?.status !== 'submitted')
        throw new ErpError(409, 'Only a submitted register can be reviewed.');
      action = body.action === 'return' ? 'returned' : 'reviewed';
      status = action;
      if (action === 'returned' || body.note)
        note = requiredText(body.note, 'Review note', 500);
    } else {
      throw new ErpError(403, 'This action is outside your role.');
    }
    const id = register?.id ?? randomUUID();
    const version = (register?.version ?? 0) + 1;
    const savedEntries = JSON.stringify(entries);
    if (register)
      await run(
        tx,
        'UPDATE register SET status = ?, version = ?, entries = ? WHERE id = ?',
        status,
        version,
        savedEntries,
        id,
      );
    else
      await run(
        tx,
        'INSERT INTO register VALUES (?, ?, ?, ?, ?, ?)',
        id,
        classId,
        date,
        status,
        version,
        savedEntries,
      );
    await run(
      tx,
      'INSERT INTO register_event VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      version,
      account.id,
      account.name,
      action,
      new Date().toISOString(),
      note,
      changed,
      savedEntries,
    );
  });
  return getRegister(db, account, classId, date);
}

function emptyCounts(): Counts {
  return {
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
}
function addCounts(target: Counts, source: Counts) {
  for (const key of Object.keys(target) as (keyof Counts)[])
    target[key] += source[key];
}

export async function report(
  db: Query,
  account: Account,
  date: string,
  schoolId: string | null,
): Promise<Report> {
  if (!['principal', 'officer', 'commissioner'].includes(account.role))
    throw new ErpError(
      403,
      'Reports are available to principals, officers and the Commissioner.',
    );
  const scoped = (await workspace(db, account)).schools;
  const schools =
    schoolId === null
      ? scoped
      : scoped.filter((school) => school.id === schoolId);
  if (schoolId !== null && !schools.length) missing();
  const totals = emptyCounts();
  const summaries = await Promise.all(
    schools.map(async (school) => {
      const schoolTotals = emptyCounts();
      const rows = await many<
        ClassSection & {
          enrolled: number;
          status: RegisterStatus | null;
          entries: string | null;
        }
      >(
        db,
        `
      SELECT c.id, c.school_id AS schoolId, c.grade, c.section, r.status, r.entries,
        (SELECT COUNT(*) FROM enrolment e WHERE e.class_id = c.id AND e.effective_on <= ?) AS enrolled
      FROM class_section c LEFT JOIN register r ON r.class_id = c.id AND r.day = ?
      WHERE c.school_id = ? AND c.effective_on <= ? ORDER BY c.grade, c.section`,
        date,
        date,
        school.id,
        date,
      );
      const classes = rows.map(
        ({ enrolled, status, entries, ...classSection }): Coverage => {
          const counts = emptyCounts();
          const coverageStatus =
            status ?? (enrolled ? 'not submitted' : 'no enrolment');
          if (coverageStatus !== 'no enrolment') counts.expected = 1;
          if (coverageStatus === 'not submitted') counts.missing = 1;
          if (coverageStatus === 'returned') counts.returned = 1;
          if (status === 'submitted' || status === 'reviewed') {
            counts[status] = 1;
            for (const entry of JSON.parse(
              entries ?? '[]',
            ) as AttendanceEntry[]) {
              counts[entry.mark]++;
              counts.total++;
            }
          }
          addCounts(schoolTotals, counts);
          return {
            classSection,
            status: coverageStatus,
            enrolled: entries
              ? (JSON.parse(entries) as AttendanceEntry[]).length
              : enrolled,
            counts,
          };
        },
      );
      addCounts(totals, schoolTotals);
      return {
        school,
        totals: schoolTotals,
        classes:
          account.role === 'principal' || schoolId !== null
            ? classes
            : undefined,
      };
    }),
  );
  return { date, totals, schools: summaries };
}

export function reportCsv(view: Report) {
  const columns = [
    'expected',
    'submitted',
    'reviewed',
    'returned',
    'missing',
    'present',
    'absent',
    'leave',
    'total',
  ] as const;
  const rows = [['Date', 'School', 'Class', 'Register status', ...columns]];
  for (const { school, totals, classes } of view.schools) {
    rows.push([
      view.date,
      school.name,
      '',
      'School total',
      ...columns.map((key) => String(totals[key])),
    ]);
    for (const entry of classes ?? [])
      rows.push([
        view.date,
        school.name,
        `${entry.classSection.grade} ${entry.classSection.section}`,
        entry.status,
        ...columns.map((key) => String(entry.counts[key])),
      ]);
  }
  // Protect spreadsheet users from administrator-entered formula prefixes.
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(cell) ? "'" + cell : cell;
          return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
}
