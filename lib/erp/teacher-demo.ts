import type { InStatement } from '@libsql/client';
import { many, one, write, type Database } from './database';
export async function seedTeacherDemo(db: Database) {
  await write(db, async (tx) => {
    if (
      await one(tx, "SELECT id FROM school_activity WHERE id='teacher-demo-v1'")
    )
      return;
    const schools = await many<{ id: string; name: string }>(
      tx,
      'SELECT id,name FROM school',
    );
    if (
      schools.length !== 2 ||
      !schools.some(
        (s) =>
          s.id === 'school-a' && s.name === 'NMC Demo School A · Fictional',
      ) ||
      !schools.some(
        (s) =>
          s.id === 'school-b' && s.name === 'NMC Demo School B · Fictional',
      )
    )
      return;
    for (const suffix of ['a', 'b'])
      if (
        !(await one(
          tx,
          "SELECT a.id FROM account a JOIN class_assignment ca ON ca.account_id=a.id WHERE a.id=? AND a.name=? AND a.role='teacher' AND ca.class_id=?",
          `teacher.${suffix}`,
          `Demo Teacher ${suffix.toUpperCase()}`,
          `class-${suffix}`,
        ))
      )
        return;
    const existing = await many<{
      weekday: number;
      start: string;
      end: string;
      teacher_id: string;
      class_id: string;
    }>(tx, 'SELECT weekday,start,end,teacher_id,class_id FROM teaching_period');
    const statements: InStatement[] = [];
    for (const suffix of ['a', 'b'])
      for (let day = 1; day <= 5; day++)
        for (const [index, start, end, subject] of [
          [1, '09:00', '09:40', 'Mathematics'],
          [2, '10:00', '10:40', 'English'],
          [3, '11:00', '11:40', 'Science'],
        ] as const) {
          // Do not insert conflicting samples if a principal has already scheduled work.
          const overlap = existing.some(
            (row) =>
              row.weekday === day &&
              row.start < end &&
              row.end > start &&
              (row.teacher_id === `teacher.${suffix}` ||
                row.class_id === `class-${suffix}`),
          );
          if (overlap) continue;
          statements.push({
            sql: 'INSERT INTO teaching_period VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
            args: [
              `demo-period-${suffix}-${day}-${index}`,
              `teacher.${suffix}`,
              `class-${suffix}`,
              day,
              start,
              end,
              subject,
              'Fictional classroom A',
            ],
          });
        }
    statements.push({
      sql: 'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        'teacher-demo-v1',
        'school-a',
        'teacher.a',
        'teacher-demo-v1',
        'fictional timetable examples',
        'Sample weekly teaching periods; school confirmation required.',
        new Date().toISOString(),
      ],
    });
    await tx.batch(statements);
  });
}
