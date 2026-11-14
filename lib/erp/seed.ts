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
  ['parent.a', 'Demo Guardian A', 'parent'],
  ['parent.b', 'Demo Guardian B', 'parent'],
  ['office.a', 'Demo School Office A', 'clerk'],
  ['accounts.a', 'Demo Accounts Officer A', 'accountant'],
  ['library.a', 'Demo Librarian A', 'librarian'],
  ['support.a', 'Demo Support Staff A', 'support'],
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
    ['office.a', 'school-a'],
    ['accounts.a', 'school-a'],
    ['library.a', 'school-a'],
    ['support.a', 'school-a'],
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
  for (const [parent, student] of [
    ['parent.a', 'class-a-student-1'],
    ['parent.b', 'class-b-student-1'],
  ])
    statements.push({
      sql: 'INSERT INTO guardian_link VALUES (?, ?)',
      args: [parent, student],
    });
  statements.push({
    sql: 'INSERT INTO school_notice VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [
      'welcome-a',
      'school-a',
      'Welcome to your connected school',
      'Check attendance, send requests to the school office, and follow school announcements here. All records in this pilot are fictional.',
      'all',
      'principal.a',
      new Date().toISOString(),
    ],
  });
  for (const [id, staff, title, body] of [
    [
      'office-task',
      'office.a',
      'Check class enrolment records',
      'Review the fictional class lists and report any missing roll numbers.',
    ],
    [
      'accounts-task',
      'accounts.a',
      'Prepare the monthly grant checklist',
      'Gather supporting documents for principal review. No payment is processed here.',
    ],
    [
      'library-task',
      'library.a',
      'Review classroom reading materials',
      'Check availability of reading materials for Class 5 and send a library request for shortages.',
    ],
    [
      'support-task',
      'support.a',
      'Check classroom readiness',
      'Inspect classroom seating and cleanliness; report maintenance needs to the principal.',
    ],
  ])
    statements.push({
      sql: "INSERT INTO staff_task VALUES (?, 'school-a', ?, ?, ?, 'open', '', 1)",
      args: [id, staff, title, body],
    });
  await write(db, async (tx) => {
    if (await one(tx, 'SELECT id FROM account LIMIT 1'))
      throw new Error('Seed requires an empty ERP database.');
    await tx.batch(statements);
  });
}
