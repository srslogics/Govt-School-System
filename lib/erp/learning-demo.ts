import type { InStatement } from '@libsql/client';
import { many, one, write, type Database } from './database';
import { todayInNagpur } from './model';

// Fictional examples only. Exact identities prevent sample content being added
// to a deployment using real or customised school/learner records.
export async function seedLearningDemo(db: Database) {
  await write(db, async (tx) => {
    const done = await one(
      tx,
      "SELECT id FROM school_activity WHERE id='learning-demo-v1'",
    );
    if (done) return;
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
    for (const suffix of ['a', 'b']) {
      const student = await one<{ name: string }>(
        tx,
        'SELECT name FROM enrolment WHERE id=?',
        `class-${suffix}-student-1`,
      );
      if (student?.name !== `Sample learner ${suffix.toUpperCase()}-1`) return;
      const teacher = await one(
        tx,
        "SELECT id FROM account WHERE id=? AND role='teacher' AND name=?",
        `teacher.${suffix}`,
        `Demo Teacher ${suffix.toUpperCase()}`,
      );
      if (!teacher) return;
    }
    const today = todayInNagpur();
    const due = new Date(today + 'T12:00:00Z');
    due.setUTCDate(due.getUTCDate() + 3);
    const statements: InStatement[] = [];
    for (const suffix of ['a', 'b']) {
      for (const [subject, score, feedback] of [
        [
          'Mathematics',
          78,
          'Fictional demo feedback: strong number skills. Practise word problems and explain each step.',
        ],
        [
          'English',
          84,
          'Fictional demo feedback: reads confidently. Focus on punctuation and a short paragraph each day.',
        ],
        [
          'Science',
          81,
          'Fictional demo feedback: understands core concepts. Use labelled diagrams when explaining observations.',
        ],
      ] as const)
        statements.push({
          sql: 'INSERT INTO assessment VALUES (?, ?, ?, ?, ?, ?, 100, ?, 1, ?, 1)',
          args: [
            `demo-${suffix}-${subject}`,
            `class-${suffix}-student-1`,
            subject,
            'Fictional sample assessment',
            today,
            score,
            feedback,
            `teacher.${suffix}`,
          ],
        });
      statements.push({
        sql: 'INSERT INTO homework VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        args: [
          `demo-homework-${suffix}`,
          `class-${suffix}`,
          'Mathematics',
          'Fictional demo: everyday maths',
          'Solve five examples of addition and subtraction using household objects. Explain one solution in your completion note.',
          due.toISOString().slice(0, 10),
          new Date().toISOString(),
          `teacher.${suffix}`,
        ],
      });
    }
    statements.push({
      sql: 'INSERT INTO school_activity VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        'learning-demo-v1',
        'school-a',
        'teacher.a',
        'learning-demo-v1',
        'fictional learning examples',
        'Clearly labelled sample results and homework; attendance is not generated.',
        new Date().toISOString(),
      ],
    });
    await tx.batch(statements);
  });
}
