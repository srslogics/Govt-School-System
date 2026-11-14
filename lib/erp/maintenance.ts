import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import {
  schoolStaffRoles,
  todayInNagpur,
  type Account,
  type School,
} from './model';
import { ErpError, missing, requiredText } from './validation';

export type MaintenanceTicket = {
  id: string;
  schoolId: string;
  title: string;
  category: string;
  location: string;
  priority: 'normal' | 'high' | 'urgent';
  status:
    | 'open'
    | 'assigned'
    | 'in-progress'
    | 'blocked'
    | 'reported'
    | 'closed'
    | 'cancelled';
  reporterId: string;
  reporter: string;
  assigneeId: string | null;
  assignee: string | null;
  due: string | null;
  details: string;
  progress: string;
  verification: string;
  requestId: string | null;
  officeStatus: string | null;
  at: string;
  version: number;
};
export type MaintenanceView = {
  schools: School[];
  tickets: MaintenanceTicket[];
  staff: { id: string; name: string; schoolId: string }[];
  history: {
    id: string;
    targetId: string;
    actor: string;
    note: string;
    at: string;
  }[];
};
const columns = `SELECT t.id,t.school_id AS schoolId,t.title,t.category,t.location,t.priority,t.status,t.reporter_id AS reporterId,r.name AS reporter,t.assignee_id AS assigneeId,a.name AS assignee,t.due,t.details,t.progress,t.verification,t.request_id AS requestId,e.status AS officeStatus,t.created_at AS at,t.version FROM maintenance_ticket t JOIN account r ON r.id=t.reporter_id LEFT JOIN account a ON a.id=t.assignee_id LEFT JOIN education_record e ON e.id=t.request_id`;
function allow(account: Account) {
  if (!schoolStaffRoles.includes(account.role))
    throw new ErpError(
      403,
      'Maintenance records are available to assigned school staff.',
    );
}
function visibility(account: Account) {
  return account.role === 'principal'
    ? { sql: '', args: [] as string[] }
    : account.role === 'support'
      ? {
          sql: ' AND (t.assignee_id=? OR t.reporter_id=?)',
          args: [account.id, account.id],
        }
      : { sql: ' AND t.reporter_id=?', args: [account.id] };
}
export async function readMaintenance(
  db: Query,
  account: Account,
): Promise<MaintenanceView> {
  allow(account);
  const schools = (await workspace(db, account)).schools,
    result: MaintenanceView = { schools, tickets: [], staff: [], history: [] };
  if (!schools.length) return result;
  const ids = schools.map((s) => s.id),
    slots = ids.map(() => '?').join(','),
    personal = visibility(account),
    args = [...ids, ...personal.args];
  result.tickets = await many(
    db,
    `${columns} WHERE t.school_id IN (${slots})${personal.sql} ORDER BY t.created_at DESC,t.id`,
    ...args,
  );
  if (account.role === 'principal')
    result.staff = await many(
      db,
      `SELECT a.id,a.name,s.school_id AS schoolId FROM account a JOIN school_assignment s ON s.account_id=a.id WHERE a.role='support' AND s.school_id IN (${slots}) ORDER BY a.name`,
      ...ids,
    );
  result.history = await many(
    db,
    `SELECT h.id,h.target_id AS targetId,a.name AS actor,h.note,h.happened_at AS at FROM school_activity h JOIN maintenance_ticket t ON t.id=h.target_id JOIN account a ON a.id=h.actor_id WHERE t.school_id IN (${slots})${personal.sql} AND h.action LIKE 'maintenance %' ORDER BY h.happened_at DESC`,
    ...args,
  );
  return result;
}
export async function updateMaintenance(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  allow(account);
  return write(db, async (tx) => {
    const schoolId = requiredText(body.schoolId, 'School');
    if (!(await workspace(tx, account)).schools.some((s) => s.id === schoolId))
      missing();
    const action = requiredText(body.action, 'Action'),
      id = typeof body.id === 'string' && body.id ? body.id : randomUUID(),
      personal = visibility(account);
    const before = body.id
      ? await one<MaintenanceTicket>(
          tx,
          `${columns} WHERE t.id=? AND t.school_id=?${personal.sql}`,
          id,
          schoolId,
          ...personal.args,
        )
      : undefined;
    if (body.id && !before) missing();
    if (before && body.version !== before.version)
      throw new ErpError(
        409,
        'This maintenance ticket changed. Refresh before continuing.',
      );
    const principal = () => {
      if (account.role !== 'principal')
        throw new ErpError(
          403,
          'Only the school principal can assign, verify or escalate maintenance work.',
        );
    };
    const terminal = (row: MaintenanceTicket) =>
      ['closed', 'cancelled'].includes(row.status);
    const note = requiredText(body.note, 'Action note', 2000),
      at = new Date().toISOString();
    let status: MaintenanceTicket['status'],
      assigneeId = before?.assigneeId ?? null,
      due = before?.due ?? null,
      progress = before?.progress ?? '',
      verification = before?.verification ?? '',
      requestId = before?.requestId ?? null,
      priority = before?.priority ?? 'normal';
    if (action === 'create') {
      if (body.id) throw new ErpError(400, 'Create a new maintenance ticket.');
      status = 'open';
      const category = requiredText(body.category, 'Maintenance category');
      if (
        ![
          'cleaning',
          'water',
          'electrical',
          'furniture',
          'grounds',
          'safety',
          'general',
        ].includes(category)
      )
        throw new ErpError(400, 'Choose a valid maintenance category.');
      const urgency = requiredText(body.priority, 'Urgency');
      if (!['normal', 'high', 'urgent'].includes(urgency))
        throw new ErpError(400, 'Choose normal, high or urgent.');
      priority = urgency as MaintenanceTicket['priority'];
      await run(
        tx,
        "INSERT INTO maintenance_ticket VALUES (?,?,?,?,?,?,'open',?,NULL,NULL,?,'','',NULL,?,1)",
        id,
        schoolId,
        requiredText(body.title, 'Ticket title'),
        category,
        requiredText(body.location, 'Location', 120),
        priority,
        account.id,
        note,
        at,
      );
    } else {
      if (!before) missing();
      status = before.status;
      if (action === 'assign') {
        principal();
        if (terminal(before))
          throw new ErpError(409, 'Reopen this ticket before assigning work.');
        const assigned = requiredText(body.assigneeId, 'Support staff member');
        if (
          !(await one(
            tx,
            "SELECT a.id FROM account a JOIN school_assignment s ON s.account_id=a.id WHERE a.id=? AND a.role='support' AND s.school_id=?",
            assigned,
            schoolId,
          ))
        )
          throw new ErpError(
            400,
            'Choose support staff currently assigned to this school.',
          );
        assigneeId = assigned;
        const deadline = requiredText(body.due, 'Work deadline', 10),
          parsed = new Date(deadline + 'T00:00:00Z');
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
          !Number.isFinite(+parsed) ||
          parsed.toISOString().slice(0, 10) !== deadline ||
          deadline < todayInNagpur()
        )
          throw new ErpError(400, 'Choose a deadline today or later.');
        due = deadline;
        const urgency = requiredText(body.priority, 'Urgency');
        if (!['normal', 'high', 'urgent'].includes(urgency))
          throw new ErpError(400, 'Choose a valid urgency.');
        priority = urgency as MaintenanceTicket['priority'];
        status = 'assigned';
        verification = note;
      } else if (action === 'progress') {
        if (account.role !== 'support' || before.assigneeId !== account.id)
          throw new ErpError(
            403,
            'Only the assigned support staff member can report work.',
          );
        if (!['assigned', 'in-progress', 'blocked'].includes(before.status))
          throw new ErpError(
            409,
            'Progress can be reported only on assigned, active or blocked work.',
          );
        if (
          !['in-progress', 'blocked', 'reported'].includes(String(body.status))
        )
          throw new ErpError(
            400,
            'Choose in progress, blocked or report completed work.',
          );
        status = body.status as MaintenanceTicket['status'];
        progress = note;
      } else if (action === 'verify') {
        principal();
        if (before.status !== 'reported')
          throw new ErpError(
            409,
            'A staff completion report is required before verification.',
          );
        if (body.status !== 'closed' && body.status !== 'in-progress')
          throw new ErpError(
            400,
            'Choose verified closure or return for further work.',
          );
        status = body.status;
        verification = note;
      } else if (action === 'cancel') {
        principal();
        if (terminal(before))
          throw new ErpError(
            409,
            'This ticket is already closed or cancelled.',
          );
        status = 'cancelled';
        verification = note;
      } else if (action === 'reopen') {
        principal();
        if (!terminal(before))
          throw new ErpError(
            409,
            'Only a closed or cancelled ticket can be reopened.',
          );
        status = 'open';
        assigneeId = null;
        due = null;
        progress = '';
        verification = note;
      } else if (action === 'escalate') {
        principal();
        if (terminal(before))
          throw new ErpError(
            409,
            'Closed or cancelled work cannot be escalated.',
          );
        if (requestId)
          throw new ErpError(
            409,
            'This ticket already has an education-office request. Follow up that existing request.',
          );
        requestId = randomUUID();
        const details = `Maintenance ticket: ${before.title}\nLocation: ${before.location}\nSchool report: ${before.details}\nLatest staff progress: ${before.progress || 'Not yet reported'}\nPrincipal escalation: ${note}`;
        const requestData = {
          title: before.title,
          category: 'maintenance',
          priority: before.priority === 'normal' ? 'normal' : 'high',
          note: details,
          updatedBy: account.name,
          updatedAt: at,
        };
        await run(
          tx,
          "INSERT INTO education_record VALUES (?,?,'request','submitted',?,?,?,1)",
          requestId,
          schoolId,
          JSON.stringify(requestData),
          account.id,
          at,
        );
        await run(
          tx,
          'INSERT INTO school_activity VALUES (?,?,?,?,?,?,?)',
          randomUUID(),
          schoolId,
          account.id,
          requestId,
          'oversight request',
          JSON.stringify({
            note: details,
            before: 'new',
            after: 'submitted',
            version: 1,
          }),
          at,
        );
        verification = note;
      } else throw new ErpError(400, 'Unknown maintenance action.');
      await run(
        tx,
        'UPDATE maintenance_ticket SET assignee_id=?,due=?,priority=?,status=?,progress=?,verification=?,request_id=?,version=version+1 WHERE id=?',
        assigneeId,
        due,
        priority,
        status,
        progress,
        verification,
        requestId,
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
      'maintenance ' + action,
      JSON.stringify({
        note,
        before: before
          ? {
              status: before.status,
              assigneeId: before.assigneeId,
              due: before.due,
              priority: before.priority,
            }
          : null,
        after: { status, assigneeId, due, priority, requestId },
        version: (before?.version ?? 0) + 1,
      }),
      at,
    );
    return { ok: true, id, requestId };
  });
}
