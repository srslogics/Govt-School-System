import type { InStatement } from '@libsql/client';
import { passwordHash } from './auth';
import { one, write, type Database } from './database';
import { todayInNagpur, type Role } from './model';

export const fictionalAccounts: [string, string, Role][] = [
  ['admin', 'Demo Setup Administrator', 'administrator'],
  ['teacher.a', 'Demo Teacher A', 'teacher'],
  ['teacher.b', 'Demo Teacher B', 'teacher'],
  ['principal.a', 'Demo Principal A', 'principal'],
  ['principal.b', 'Demo Principal B', 'principal'],
  ['officer.a', 'Demo Education Officer A', 'officer'],
  ['commissioner', 'Demo Commissioner', 'commissioner'],
];

export async function seedFictionalSchools(
  db: Database,
  passwordFor: (username: string) => string,
) {
  const date = todayInNagpur();
  const statements: InStatement[] = [];
  for (const [id, code, name] of [
    ['school-a', 'DEMO-A', 'NMC Demo School A · Fictional'],
    ['school-b', 'DEMO-B', 'NMC Demo School B · Fictional'],
  ])
    statements.push({
      sql: 'INSERT INTO school VALUES (?, ?, ?)',
      args: [id, code, name],
    });
  for (const [id, school, grade, section, count] of [
    ['class-a', 'school-a', 'Class 5', 'A', 3],
    ['class-a-b', 'school-a', 'Class 5', 'B', 2],
    ['class-b', 'school-b', 'Class 6', 'A', 5],
  ] as const) {
    statements.push({
      sql: 'INSERT INTO class_section VALUES (?, ?, ?, ?, ?)',
      args: [id, school, grade, section, date],
    });
    for (let i = 1; i <= count; i++)
      statements.push({
        sql: 'INSERT INTO enrolment VALUES (?, ?, ?, ?, ?)',
        args: [
          `${id}-student-${i}`,
          id,
          `Sample learner ${id.slice(6).toUpperCase()}-${i}`,
          String(i),
          date,
        ],
      });
  }
  for (const [id, name, role] of fictionalAccounts)
    statements.push({
      sql: 'INSERT INTO account VALUES (?, ?, ?, ?, ?)',
      args: [id, id, name, role, passwordHash(passwordFor(id))],
    });
  for (const [id, school] of [
    ['principal.a', 'school-a'],
    ['principal.b', 'school-b'],
    ['officer.a', 'school-a'],
  ])
    statements.push({
      sql: 'INSERT INTO school_assignment VALUES (?, ?)',
      args: [id, school],
    });
  for (const [id, section] of [
    ['teacher.a', 'class-a'],
    ['teacher.b', 'class-b'],
  ])
    statements.push({
      sql: 'INSERT INTO class_assignment VALUES (?, ?)',
      args: [id, section],
    });
  await write(db, async (tx) => {
    if (await one(tx, 'SELECT id FROM account LIMIT 1'))
      throw new Error('Seed requires an empty ERP database.');
    await tx.batch(statements);
  });
}
