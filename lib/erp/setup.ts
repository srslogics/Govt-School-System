import { randomUUID } from 'node:crypto';
import { passwordHash, usernameValue } from './auth';
import { many, one, write, run, type Query, type Database } from './database';
import { todayInNagpur, type Account, type Setup } from './model';
import { dateValue, ErpError, missing, requiredText } from './validation';

export async function readSetup(db: Query, account: Account): Promise<Setup> {
  if (account.role !== 'administrator')
    throw new ErpError(403, 'School setup requires an administrator.');
  return {
    schools: await many(db, 'SELECT id, code, name FROM school ORDER BY code'),
    classes: await many(
      db,
      'SELECT id, school_id AS schoolId, grade, section FROM class_section ORDER BY grade, section',
    ),
    staff: await many(
      db,
      'SELECT id, username, name, role FROM account ORDER BY username',
    ),
    assignments: await many(
      db,
      `SELECT account_id AS accountId, class_id AS targetId FROM class_assignment
      UNION ALL SELECT account_id, school_id FROM school_assignment`,
    ),
    enrolments: await many(
      db,
      'SELECT id, class_id AS classId, name, roll, effective_on AS effectiveOn FROM enrolment ORDER BY roll',
    ),
  };
}

export async function updateSetup(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  if (account.role !== 'administrator')
    throw new ErpError(403, 'School setup requires an administrator.');
  try {
    await write(db, async (tx) => {
      switch (body.action) {
        case 'school':
          await run(
            tx,
            'INSERT INTO school VALUES (?, ?, ?)',
            randomUUID(),
            requiredText(body.code, 'School code', 24),
            requiredText(body.name, 'School name'),
          );
          break;
        case 'class': {
          const schoolId = requiredText(body.schoolId, 'School');
          if (!(await one(tx, 'SELECT id FROM school WHERE id = ?', schoolId)))
            missing();
          await run(
            tx,
            'INSERT INTO class_section VALUES (?, ?, ?, ?, ?)',
            randomUUID(),
            schoolId,
            requiredText(body.grade, 'Class', 32),
            requiredText(body.section, 'Section', 16),
            body.effectiveOn ? dateValue(body.effectiveOn) : todayInNagpur(),
          );
          break;
        }
        case 'student': {
          const classId = requiredText(body.classId, 'Class');
          const section = await one<{ effective_on: string }>(
            tx,
            'SELECT effective_on FROM class_section WHERE id = ?',
            classId,
          );
          if (!section) missing();
          const day = body.effectiveOn
            ? dateValue(body.effectiveOn)
            : todayInNagpur();
          if (day < section.effective_on)
            throw new ErpError(
              400,
              'Enrolment cannot precede the class start date.',
            );
          await run(
            tx,
            'INSERT INTO enrolment VALUES (?, ?, ?, ?, ?)',
            randomUUID(),
            classId,
            requiredText(body.name, 'Student name'),
            requiredText(body.roll, 'Roll number', 24),
            day,
          );
          break;
        }
        case 'staff': {
          const { role, password } = body;
          if (role !== 'teacher' && role !== 'principal' && role !== 'officer')
            throw new ErpError(
              400,
              'Choose teacher, principal or education officer.',
            );
          if (typeof password !== 'string')
            throw new ErpError(400, 'A password is required.');
          await run(
            tx,
            'INSERT INTO account VALUES (?, ?, ?, ?, ?)',
            randomUUID(),
            usernameValue(body.username),
            requiredText(body.name, 'Staff name'),
            role,
            passwordHash(password),
          );
          break;
        }
        case 'assign':
        case 'unassign': {
          const id = requiredText(body.accountId, 'Staff account');
          const staff = await one<Account>(
            tx,
            'SELECT id, role FROM account WHERE id = ?',
            id,
          );
          if (!staff) missing();
          const teacher = staff.role === 'teacher';
          if (
            !teacher &&
            staff.role !== 'principal' &&
            staff.role !== 'officer'
          )
            throw new ErpError(400, 'Choose a teacher, principal or officer.');
          const target = requiredText(
            body.targetId,
            teacher ? 'Class' : 'School',
          );
          const table = teacher ? 'class_assignment' : 'school_assignment';
          const column = teacher ? 'class_id' : 'school_id';
          if (
            !(await one(
              tx,
              `SELECT id FROM ${teacher ? 'class_section' : 'school'} WHERE id = ?`,
              target,
            ))
          )
            missing();
          if (body.action === 'unassign') {
            await run(
              tx,
              `DELETE FROM ${table} WHERE account_id = ? AND ${column} = ?`,
              id,
              target,
            );
          } else {
            if (
              staff.role === 'principal' &&
              (await one(
                tx,
                'SELECT school_id FROM school_assignment WHERE account_id = ? AND school_id <> ?',
                id,
                target,
              ))
            )
              throw new ErpError(
                409,
                'Remove the previous school assignment before reassigning a principal.',
              );
            await run(
              tx,
              `INSERT INTO ${table} VALUES (?, ?) ON CONFLICT DO NOTHING`,
              id,
              target,
            );
          }
          break;
        }
        default:
          throw new ErpError(400, 'Unknown setup action.');
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    )
      throw new ErpError(
        409,
        'That code, class and section, roll number or username already exists.',
      );
    throw error;
  }
  return readSetup(db, account);
}
