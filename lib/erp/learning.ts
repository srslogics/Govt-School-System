import { randomUUID } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import { many, one, run, write, type Database, type Query } from './database';
import type {
  Account,
  AttendanceEntry,
  ClassSection,
  Mark,
  Student,
} from './model';
import { workspace } from './attendance';
import {
  dateValue,
  ErpError,
  missing,
  object,
  requiredText,
} from './validation';

export type Learner = Student & {
  classId: string;
  schoolId: string;
  schoolName: string;
  classLabel: string;
};
export type Assessment = {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  subject: string;
  exam: string;
  day: string;
  score: number;
  maximum: number;
  feedback: string;
  published: number;
  version: number;
};
export type Homework = {
  id: string;
  classId: string;
  subject: string;
  title: string;
  body: string;
  due: string;
  at: string;
  version: number;
};
export type Submission = {
  homeworkId: string;
  studentId: string;
  studentName: string;
  note: string;
  feedback: string;
  at: string;
  version: number;
};
export type LearningView = {
  learners: Learner[];
  classes: ClassSection[];
  assessments: Assessment[];
  homework: Homework[];
  submissions: Submission[];
  attendance: {
    studentId: string;
    day: string;
    mark: Mark | null;
    status: string;
  }[];
  month: string;
};

async function scope(db: Query, account: Account) {
  if (!['parent', 'teacher', 'principal'].includes(account.role))
    throw new ErpError(
      403,
      'Learning records are available to linked families, teachers and principals.',
    );
  if (account.role === 'parent')
    return {
      classes: [] as ClassSection[],
      learners: await many<Learner>(
        db,
        `SELECT e.id,e.name,e.roll,e.class_id AS classId,c.school_id AS schoolId,s.name AS schoolName,c.grade || ' · Section ' || c.section AS classLabel FROM enrolment e JOIN guardian_link g ON g.enrolment_id=e.id JOIN class_section c ON c.id=e.class_id JOIN school s ON s.id=c.school_id WHERE g.account_id=? ORDER BY e.name`,
        account.id,
      ),
    };
  const classes = (await workspace(db, account)).classes;
  if (!classes.length) return { classes, learners: [] as Learner[] };
  const learners = await many<Learner>(
    db,
    `SELECT e.id,e.name,e.roll,e.class_id AS classId,c.school_id AS schoolId,s.name AS schoolName,c.grade || ' · Section ' || c.section AS classLabel FROM enrolment e JOIN class_section c ON c.id=e.class_id JOIN school s ON s.id=c.school_id WHERE e.class_id IN (${classes.map(() => '?').join(',')}) ORDER BY c.grade,c.section,e.roll`,
    ...classes.map((c) => c.id),
  );
  return { classes, learners };
}
export async function readLearning(
  db: Query,
  account: Account,
  date: string,
): Promise<LearningView> {
  const { learners, classes } = await scope(db, account);
  const month = date.slice(0, 7);
  const result: LearningView = {
    learners,
    classes,
    assessments: [],
    homework: [],
    submissions: [],
    attendance: [],
    month,
  };
  if (!learners.length) return result;
  const ids = learners.map((child) => child.id);
  const classIds = [...new Set(learners.map((child) => child.classId))];
  result.assessments = await many(
    db,
    `SELECT a.id,a.student_id AS studentId,e.name AS studentName,e.class_id AS classId,a.subject,a.exam,a.day,a.score,a.maximum,a.feedback,a.published,a.version FROM assessment a JOIN enrolment e ON e.id=a.student_id WHERE a.student_id IN (${ids.map(() => '?').join(',')}) ${account.role === 'parent' ? 'AND a.published=1' : ''} AND a.day<=? ORDER BY a.day DESC,a.exam,a.subject LIMIT 500`,
    ...ids,
    date,
  );
  result.homework = await many(
    db,
    `SELECT id,class_id AS classId,subject,title,body,due,happened_at AS at,version FROM homework WHERE class_id IN (${classIds.map(() => '?').join(',')}) ORDER BY due DESC LIMIT 100`,
    ...classIds,
  );
  result.submissions = await many(
    db,
    `SELECT h.homework_id AS homeworkId,h.student_id AS studentId,e.name AS studentName,h.note,h.feedback,h.happened_at AS at,h.version FROM homework_submission h JOIN enrolment e ON e.id=h.student_id WHERE h.student_id IN (${ids.map(() => '?').join(',')}) ORDER BY h.happened_at DESC LIMIT 500`,
    ...ids,
  );
  // Only return each authorised learner's mark, never a full class snapshot.
  const registers = await many<{
    class_id: string;
    day: string;
    status: string;
    entries: string;
  }>(
    db,
    `SELECT class_id,day,status,entries FROM register WHERE class_id IN (${classIds.map(() => '?').join(',')}) AND day>=? AND day<=? ORDER BY day`,
    ...classIds,
    month + '-01',
    date,
  );
  for (const child of learners)
    for (const register of registers.filter(
      (row) => row.class_id === child.classId,
    )) {
      const entry = (JSON.parse(register.entries) as AttendanceEntry[]).find(
        (row) => row.id === child.id,
      );
      if (entry)
        result.attendance.push({
          studentId: child.id,
          day: register.day,
          status: register.status,
          mark: ['submitted', 'reviewed'].includes(register.status)
            ? entry.mark
            : null,
        });
    }
  return result;
}
function boundedNumber(value: unknown, label: string, maximum: number) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum
  )
    throw new ErpError(400, `${label} must be between 0 and ${maximum}.`);
  return value;
}
function validDay(value: unknown, future = false) {
  const day = requiredText(value, 'Date', 10);
  if (!future) return dateValue(day);
  const parsed = new Date(day + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== day
  )
    throw new ErpError(400, 'Choose a valid date.');
  return day;
}
export async function updateLearning(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  await write(db, async (tx) => {
    const { learners, classes } = await scope(tx, account);
    let target = '';
    let schoolId = '';
    let action = '';
    if (body.action === 'bulk-marks') {
      if (account.role !== 'teacher')
        throw new ErpError(403, 'Only assigned teachers enter marks.');
      const section = classes.find((row) => row.id === body.classId);
      if (!section) missing();
      if (
        !Array.isArray(body.entries) ||
        !body.entries.length ||
        body.entries.length > 200
      )
        throw new ErpError(400, 'Enter marks for 1 to 200 learners at a time.');
      const subject = requiredText(body.subject, 'Subject', 60),
        exam = requiredText(body.exam, 'Assessment', 100),
        day = validDay(body.day),
        maximum = boundedNumber(body.maximum, 'Maximum marks', 1000);
      if (!maximum)
        throw new ErpError(400, 'Maximum marks must be greater than zero.');
      const saved = await many<Assessment>(
        tx,
        'SELECT a.id,a.student_id AS studentId,a.published,a.version,a.score,a.maximum,a.feedback FROM assessment a JOIN enrolment e ON e.id=a.student_id WHERE e.class_id=? AND a.subject=? COLLATE NOCASE AND a.exam=? COLLATE NOCASE AND a.day=?',
        section.id,
        subject,
        exam,
        day,
      );
      const statements: InStatement[] = [];
      const seen = new Set<string>();
      for (const input of body.entries) {
        const entry = object(input),
          child = learners.find(
            (row) => row.id === entry.studentId && row.classId === section.id,
          );
        if (!child) missing();
        if (seen.has(child.id))
          throw new ErpError(400, 'Each learner can appear only once.');
        seen.add(child.id);
        const matches = saved.filter((row) => row.studentId === child.id);
        if (matches.length > 1)
          throw new ErpError(
            409,
            'Duplicate legacy assessment rows need school review before bulk editing.',
          );
        const existing = matches[0];
        if (existing?.published)
          throw new ErpError(409, 'A published result cannot be overwritten.');
        if (entry.version !== (existing?.version ?? 0))
          throw new ErpError(409, 'Marks changed. Refresh before saving.');
        const score = boundedNumber(entry.score, 'Marks', maximum),
          feedback = requiredText(entry.feedback, 'Feedback', 1000),
          id = existing?.id ?? randomUUID();
        if (existing)
          statements.push({
            sql: 'UPDATE assessment SET score=?,maximum=?,feedback=?,version=version+1 WHERE id=?',
            args: [score, maximum, feedback, id],
          });
        else
          statements.push({
            sql: 'INSERT INTO assessment VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)',
            args: [
              id,
              child.id,
              subject,
              exam,
              day,
              score,
              maximum,
              feedback,
              account.id,
            ],
          });
        statements.push({
          sql: 'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [
            randomUUID(),
            child.schoolId,
            account.id,
            id,
            existing ? 'draft marks edited' : 'draft marks entered',
            JSON.stringify({
              previous: existing
                ? {
                    score: existing.score,
                    maximum: existing.maximum,
                    feedback: existing.feedback,
                  }
                : null,
              score,
              maximum,
              feedback,
            }),
            new Date().toISOString(),
          ],
        });
      }
      await tx.batch(statements);
      return;
    } else if (body.action === 'edit-assessment') {
      if (account.role !== 'teacher')
        throw new ErpError(403, 'Only assigned teachers edit draft marks.');
      const row = await one<Assessment>(
        tx,
        'SELECT id,student_id AS studentId,published,version,score,maximum,feedback FROM assessment WHERE id=?',
        requiredText(body.id, 'Assessment'),
      );
      const child = learners.find((child) => child.id === row?.studentId);
      if (!row || !child) missing();
      if (row.published || row.version !== body.version)
        throw new ErpError(
          409,
          'This result is published or changed. Refresh before editing.',
        );
      const maximum = boundedNumber(body.maximum, 'Maximum marks', 1000);
      if (!maximum)
        throw new ErpError(400, 'Maximum marks must be greater than zero.');
      const score = boundedNumber(body.score, 'Marks', maximum),
        feedback = requiredText(body.feedback, 'Feedback', 1000);
      await run(
        tx,
        'UPDATE assessment SET score=?,maximum=?,feedback=?,version=version+1 WHERE id=?',
        score,
        maximum,
        feedback,
        row.id,
      );
      await run(
        tx,
        'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
        randomUUID(),
        child.schoolId,
        account.id,
        row.id,
        'draft marks edited',
        JSON.stringify({
          previous: {
            score: row.score,
            maximum: row.maximum,
            feedback: row.feedback,
          },
          score,
          maximum,
          feedback,
        }),
        new Date().toISOString(),
      );
      return;
    } else if (body.action === 'assessment') {
      if (account.role !== 'teacher')
        throw new ErpError(403, 'Only assigned teachers enter marks.');
      const child = learners.find((row) => row.id === body.studentId);
      if (!child) missing();
      const maximum = boundedNumber(body.maximum, 'Maximum marks', 1000);
      if (!maximum)
        throw new ErpError(400, 'Maximum marks must be greater than zero.');
      const score = boundedNumber(body.score, 'Marks', maximum);
      if (
        await one(
          tx,
          'SELECT id FROM assessment WHERE student_id=? AND subject=? COLLATE NOCASE AND exam=? COLLATE NOCASE AND day=?',
          child.id,
          requiredText(body.subject, 'Subject', 60),
          requiredText(body.exam, 'Assessment', 100),
          validDay(body.day),
        )
      )
        throw new ErpError(
          409,
          'This learner already has a result for this assessment. Edit its draft instead.',
        );
      target = randomUUID();
      schoolId = child.schoolId;
      action = 'assessment entered';
      await run(
        tx,
        'INSERT INTO assessment VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)',
        target,
        child.id,
        requiredText(body.subject, 'Subject', 60),
        requiredText(body.exam, 'Assessment', 100),
        validDay(body.day),
        score,
        maximum,
        requiredText(body.feedback, 'Teacher feedback', 1000),
        account.id,
      );
    } else if (body.action === 'publish') {
      if (account.role !== 'principal')
        throw new ErpError(403, 'Only assigned principals publish results.');
      const row = await one<Assessment>(
        tx,
        'SELECT id,student_id AS studentId,published,version FROM assessment WHERE id=?',
        requiredText(body.id, 'Assessment'),
      );
      const child = learners.find((child) => child.id === row?.studentId);
      if (!row || !child) missing();
      if (body.version !== row.version || row.published)
        throw new ErpError(
          409,
          'This result changed. Refresh before publishing.',
        );
      target = row.id;
      schoolId = child.schoolId;
      action = 'assessment published';
      await run(
        tx,
        'UPDATE assessment SET published=1,version=version+1 WHERE id=?',
        row.id,
      );
    } else if (body.action === 'homework') {
      if (account.role !== 'teacher')
        throw new ErpError(403, 'Only assigned teachers create homework.');
      const section = classes.find((row) => row.id === body.classId);
      if (!section) missing();
      target = randomUUID();
      schoolId = section.schoolId;
      action = 'homework assigned';
      await run(
        tx,
        'INSERT INTO homework VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        target,
        section.id,
        requiredText(body.subject, 'Subject', 60),
        requiredText(body.title, 'Homework title', 120),
        requiredText(body.body, 'Instructions', 2000),
        validDay(body.due, true),
        new Date().toISOString(),
        account.id,
      );
    } else if (body.action === 'submit' || body.action === 'feedback') {
      const child = learners.find((row) => row.id === body.studentId);
      if (!child) missing();
      const homework = await one<Homework>(
        tx,
        'SELECT id,class_id AS classId FROM homework WHERE id=?',
        requiredText(body.id, 'Homework'),
      );
      if (!homework || homework.classId !== child.classId) missing();
      const submission = await one<Submission>(
        tx,
        'SELECT version FROM homework_submission WHERE homework_id=? AND student_id=?',
        homework.id,
        child.id,
      );
      if (body.version !== (submission?.version ?? 0))
        throw new ErpError(
          409,
          'This homework changed. Refresh before saving.',
        );
      target = homework.id;
      schoolId = child.schoolId;
      if (body.action === 'submit') {
        if (account.role !== 'parent')
          throw new ErpError(
            403,
            'Only linked parents record homework completion.',
          );
        action = 'homework completion reported';
        const note = requiredText(body.note, 'Completion note', 1000);
        if (submission)
          await run(
            tx,
            "UPDATE homework_submission SET note=?,feedback='',happened_at=?,version=version+1 WHERE homework_id=? AND student_id=?",
            note,
            new Date().toISOString(),
            homework.id,
            child.id,
          );
        else
          await run(
            tx,
            "INSERT INTO homework_submission VALUES (?, ?, ?, '', ?, 1)",
            homework.id,
            child.id,
            note,
            new Date().toISOString(),
          );
      } else {
        if (account.role !== 'teacher')
          throw new ErpError(
            403,
            'Only assigned teachers give homework feedback.',
          );
        if (!submission)
          throw new ErpError(
            409,
            'The family has not reported completion yet.',
          );
        action = 'homework feedback recorded';
        await run(
          tx,
          'UPDATE homework_submission SET feedback=?,version=version+1 WHERE homework_id=? AND student_id=?',
          requiredText(body.feedback, 'Feedback', 1000),
          homework.id,
          child.id,
        );
      }
    } else throw new ErpError(400, 'Unknown learning action.');
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
      randomUUID(),
      schoolId,
      account.id,
      target,
      action,
      '',
      new Date().toISOString(),
    );
  });
  return { ok: true };
}
