import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import { todayInNagpur, type Account, type School } from './model';
import { ErpError, missing, requiredText } from './validation';
import type { OversightView } from './oversight';

export type MunicipalPriority = {
  id: string;
  schoolId: string;
  officerId: string;
  officer: string;
  title: string;
  category: string;
  priority: 'normal' | 'high';
  due: string;
  status: 'assigned' | 'in-progress' | 'reported' | 'closed';
  instructions: string;
  progress: string;
  verification: string;
  author: string;
  at: string;
  version: number;
};
export type MunicipalView = {
  priorities: MunicipalPriority[];
  officers: { id: string; name: string; schoolId: string }[];
  history: {
    id: string;
    targetId: string;
    actor: string;
    note: string;
    at: string;
  }[];
};
const select =
  'SELECT p.id,p.school_id AS schoolId,p.officer_id AS officerId,a.name AS officer,p.title,p.category,p.priority,p.due,p.status,p.instructions,p.progress,p.verification,author.name AS author,p.happened_at AS at,p.version FROM municipal_priority p JOIN account a ON a.id=p.officer_id JOIN account author ON author.id=p.author_id';
function allow(account: Account) {
  if (!['commissioner', 'officer', 'principal'].includes(account.role))
    throw new ErpError(
      403,
      'Municipal follow-ups are available to supervising officers and school principals.',
    );
}
export async function readMunicipal(
  db: Query,
  account: Account,
  assigned?: School[],
): Promise<MunicipalView> {
  allow(account);
  const schools = assigned ?? (await workspace(db, account)).schools,
    ids = schools.map((row) => row.id),
    result: MunicipalView = { priorities: [], officers: [], history: [] };
  if (!ids.length) return result;
  const slots = ids.map(() => '?').join(','),
    personal = account.role === 'officer' ? ' AND p.officer_id=?' : '',
    args = [...ids, ...(account.role === 'officer' ? [account.id] : [])];
  result.priorities = await many(
    db,
    `${select} WHERE p.school_id IN (${slots})${personal} ORDER BY p.due,p.id`,
    ...args,
  );
  if (account.role === 'commissioner')
    result.officers = await many(
      db,
      `SELECT a.id,a.name,s.school_id AS schoolId FROM account a JOIN school_assignment s ON s.account_id=a.id WHERE a.role='officer' AND s.school_id IN (${slots}) ORDER BY a.name`,
      ...ids,
    );
  result.history = await many(
    db,
    `SELECT h.id,h.target_id AS targetId,a.name AS actor,h.note,h.happened_at AS at FROM school_activity h JOIN municipal_priority p ON p.id=h.target_id JOIN account a ON a.id=h.actor_id WHERE p.school_id IN (${slots})${personal} AND h.action LIKE 'municipal %' ORDER BY h.happened_at DESC`,
    ...args,
  );
  return result;
}
export async function updateMunicipal(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  allow(account);
  if (account.role === 'principal')
    throw new ErpError(
      403,
      'Principals can read municipal priorities; the assigned officer reports progress.',
    );
  return write(db, async (tx) => {
    const schoolId = requiredText(body.schoolId, 'School');
    if (!(await workspace(tx, account)).schools.some((s) => s.id === schoolId))
      missing();
    const action = requiredText(body.action, 'Action'),
      id = typeof body.id === 'string' && body.id ? body.id : randomUUID();
    const before = body.id
      ? await one<MunicipalPriority>(
          tx,
          `${select} WHERE p.id=? AND p.school_id=? ${account.role === 'officer' ? 'AND p.officer_id=?' : ''}`,
          id,
          schoolId,
          ...(account.role === 'officer' ? [account.id] : []),
        )
      : undefined;
    if (body.id && !before) missing();
    if (before && body.version !== before.version)
      throw new ErpError(
        409,
        'This priority changed. Refresh before continuing.',
      );
    const commissioner = () => {
      if (account.role !== 'commissioner')
        throw new ErpError(
          403,
          'Only the Commissioner can assign and verify municipal priorities.',
        );
    };
    const officer = () => {
      if (account.role !== 'officer')
        throw new ErpError(
          403,
          'The assigned education officer must report progress.',
        );
    };
    const owner = async () => {
      const officerId = requiredText(body.officerId, 'Responsible officer');
      if (
        !(await one(
          tx,
          "SELECT a.id FROM account a JOIN school_assignment s ON s.account_id=a.id WHERE a.id=? AND a.role='officer' AND s.school_id=?",
          officerId,
          schoolId,
        ))
      )
        throw new ErpError(
          400,
          'Choose an education officer currently assigned to this school.',
        );
      return officerId;
    };
    const note = requiredText(body.note, 'Action remarks', 2000),
      at = new Date().toISOString();
    let status: MunicipalPriority['status'],
      officerId = before?.officerId ?? '',
      progress = before?.progress ?? '',
      verification = before?.verification ?? '';
    if (action === 'assign') {
      commissioner();
      if (before) throw new ErpError(409, 'Create a new priority.');
      officerId = await owner();
      status = 'assigned';
      const due = requiredText(body.due, 'Deadline', 10),
        parsed = new Date(due + 'T00:00:00Z');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        !Number.isFinite(+parsed) ||
        parsed.toISOString().slice(0, 10) !== due ||
        due < todayInNagpur()
      )
        throw new ErpError(400, 'Choose a deadline today or later.');
      const category = requiredText(body.category, 'Category');
      if (
        ![
          'academics',
          'staffing',
          'infrastructure',
          'finance',
          'governance',
        ].includes(category)
      )
        throw new ErpError(400, 'Choose a valid category.');
      if (!['normal', 'high'].includes(String(body.priority)))
        throw new ErpError(400, 'Choose normal or high priority.');
      await run(
        tx,
        'INSERT INTO municipal_priority VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)',
        id,
        schoolId,
        officerId,
        requiredText(body.title, 'Priority title'),
        category,
        String(body.priority),
        due,
        status,
        note,
        '',
        '',
        account.id,
        at,
      );
    } else {
      if (!before) missing();
      status = before.status;
      if (action === 'progress') {
        officer();
        if (!['assigned', 'in-progress'].includes(before.status))
          throw new ErpError(
            409,
            'Progress can be updated only while a priority is open.',
          );
        if (body.status !== 'in-progress' && body.status !== 'reported')
          throw new ErpError(400, 'Choose in progress or reported.');
        status = body.status;
        progress = note;
      } else if (action === 'verify') {
        commissioner();
        if (before.status !== 'reported')
          throw new ErpError(
            409,
            'Only an officer completion report can be verified.',
          );
        if (body.status !== 'closed' && body.status !== 'in-progress')
          throw new ErpError(400, 'Choose close or return for further work.');
        status = body.status;
        verification = note;
      } else if (action === 'reassign') {
        commissioner();
        if (before.status === 'closed')
          throw new ErpError(409, 'Closed priorities cannot be reassigned.');
        officerId = await owner();
        status = 'assigned';
        verification = note;
      } else throw new ErpError(400, 'Unknown municipal action.');
      await run(
        tx,
        'UPDATE municipal_priority SET officer_id=?,status=?,progress=?,verification=?,version=version+1 WHERE id=?',
        officerId,
        status,
        progress,
        verification,
        id,
      );
    }
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?,?,?,?,?,?,?)',
      randomUUID(),
      schoolId,
      account.id,
      id,
      'municipal ' + action,
      JSON.stringify({
        note,
        before: before
          ? { status: before.status, officerId: before.officerId }
          : null,
        after: { status, officerId },
        version: (before?.version ?? 0) + 1,
      }),
      at,
    );
    return { ok: true, id };
  });
}
export function municipalCsv(view: OversightView) {
  const rows = [
    [
      'Reporting date',
      'School code',
      'School',
      'Enrolled learners',
      'Staff accounts',
      'Teacher accounts',
      'Registers expected',
      'Registers received',
      'Present',
      'Reported marks',
      'Published results',
      'Learners assessed',
      'Average result percent',
      'Grant allocation paise',
      'Recorded expenses paise',
      'Current zero-stock item types',
      'Current escalated requests',
      'Current open municipal priorities',
    ],
  ];
  for (const s of view.schools)
    rows.push([
      view.date,
      s.code,
      s.name,
      String(s.enrolled),
      String(s.staff),
      String(s.teachers),
      String(s.attendance.expected),
      String(s.attendance.submitted + s.attendance.reviewed),
      String(s.attendance.present),
      String(s.attendance.total),
      String(s.published),
      String(s.assessed),
      s.average === null ? '' : s.average.toFixed(2),
      String(s.grants),
      String(s.expenses),
      String(s.zeroStock),
      String(
        view.records.filter(
          (row) => row.schoolId === s.id && row.status === 'escalated',
        ).length,
      ),
      String(
        view.municipal.priorities.filter(
          (row) => row.schoolId === s.id && row.status !== 'closed',
        ).length,
      ),
    ]);
  return rows
    .map((row) =>
      row
        .map(
          (cell) =>
            '"' +
            (/^[\s]*[=+@-]|^[\t\r\n]/.test(cell)
              ? "'" + cell
              : cell
            ).replaceAll('"', '""') +
            '"',
        )
        .join(','),
    )
    .join('\r\n');
}
