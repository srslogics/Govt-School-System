import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import { readLearning, type LearningView } from './learning';
import type { Account } from './model';
import { ErpError, missing, requiredText } from './validation';

export type Lesson = {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  classLabel: string;
  schoolId: string;
  schoolName: string;
  weekday: number;
  start: string;
  end: string;
  subject: string;
  room: string;
  version: number;
};
export type TeacherView = LearningView & {
  lessons: Lesson[];
  registers: { classId: string; status: string; enrolled: number }[];
  teachers: (Account & { classId: string })[];
};
export async function readTeacher(
  db: Query,
  account: Account,
  date: string,
): Promise<TeacherView> {
  if (!['teacher', 'principal'].includes(account.role))
    throw new ErpError(
      403,
      'This workspace is for teachers and school principals.',
    );
  const learning = await readLearning(db, account, date),
    classes = (await workspace(db, account)).classes;
  const result: TeacherView = {
    ...learning,
    lessons: [],
    registers: [],
    teachers: [],
  };
  if (!classes.length) return result;
  const ids = classes.map((row) => row.id),
    slots = ids.map(() => '?').join(',');
  result.lessons = await many(
    db,
    `SELECT t.id,t.teacher_id AS teacherId,a.name AS teacherName,t.class_id AS classId,c.grade||' · Section '||c.section AS classLabel,c.school_id AS schoolId,s.name AS schoolName,t.weekday,t.start,t.end,t.subject,t.room,t.version FROM teaching_period t JOIN account a ON a.id=t.teacher_id JOIN class_section c ON c.id=t.class_id JOIN school s ON s.id=c.school_id WHERE t.class_id IN (${slots}) ${account.role === 'teacher' ? 'AND t.teacher_id=?' : ''} ORDER BY t.weekday,t.start`,
    ...ids,
    ...(account.role === 'teacher' ? [account.id] : []),
  );
  result.registers = await many(
    db,
    `SELECT c.id AS classId,COALESCE(r.status,'not submitted') AS status,(SELECT COUNT(*) FROM enrolment e WHERE e.class_id=c.id AND e.effective_on<=?) AS enrolled FROM class_section c LEFT JOIN register r ON r.class_id=c.id AND r.day=? WHERE c.id IN (${slots}) AND c.effective_on<=?`,
    date,
    date,
    ...ids,
    date,
  );
  if (account.role === 'principal')
    result.teachers = await many(
      db,
      `SELECT a.id,a.username,a.name,a.role,ca.class_id AS classId FROM account a JOIN class_assignment ca ON ca.account_id=a.id WHERE a.role='teacher' AND ca.class_id IN (${slots}) ORDER BY a.name`,
      ...ids,
    );
  return result;
}
function time(value: unknown) {
  const text = requiredText(value, 'Time', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text))
    throw new ErpError(400, 'Choose a valid time.');
  return text;
}
export async function updateTeacher(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  if (account.role !== 'principal')
    throw new ErpError(403, 'Only school principals manage the timetable.');
  await write(db, async (tx) => {
    const section = (await workspace(tx, account)).classes.find(
      (row) => row.id === body.classId,
    );
    if (!section) missing();
    const teacherId = requiredText(body.teacherId, 'Teacher');
    if (
      !(await one(
        tx,
        "SELECT a.id FROM account a JOIN class_assignment ca ON ca.account_id=a.id WHERE a.id=? AND a.role='teacher' AND ca.class_id=?",
        teacherId,
        section.id,
      ))
    )
      missing();
    const weekday = body.weekday;
    if (
      typeof weekday !== 'number' ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7
    )
      throw new ErpError(400, 'Choose a weekday.');
    const start = time(body.start),
      end = time(body.end);
    if (end <= start)
      throw new ErpError(400, 'End time must be after start time.');
    if (
      await one(
        tx,
        'SELECT id FROM teaching_period WHERE weekday=? AND start<? AND end>? AND (teacher_id=? OR class_id=?)',
        weekday,
        end,
        start,
        teacherId,
        section.id,
      )
    )
      throw new ErpError(
        409,
        'The teacher or class already has a period at this time.',
      );
    const id = randomUUID();
    await run(
      tx,
      'INSERT INTO teaching_period VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      id,
      teacherId,
      section.id,
      weekday,
      start,
      end,
      requiredText(body.subject, 'Subject', 60),
      requiredText(body.room, 'Room', 60),
    );
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
      randomUUID(),
      section.schoolId,
      account.id,
      id,
      'timetable period added',
      `${weekday} ${start}-${end}`,
      new Date().toISOString(),
    );
  });
  return { ok: true };
}
