import { commitSampleGroups, type SampleGroup } from './sample-batch';
import type { InStatement } from '@libsql/client';
import { randomBytes } from 'node:crypto';
import { passwordHash } from './auth';
import { many, one, type Database } from './database';
import { fictionalAccounts } from './seed';
import { todayInNagpur } from './model';

const marker = 'ss49-expanded-sample-v1';
const prefix = 'ss49-sample-';
const meetingOrigin = 'https://govt-school-system.onrender.com';
const schoolNames = [
  'Sahyadri Marathi Primary',
  'Vidya English Primary',
  'Pragati Hindi Primary',
  'Dnyandeep Marathi School',
  'Udaan Urdu Primary',
  'Samata Upper Primary',
];
const firstNames = [
  'Aarav',
  'Anaya',
  'Atharva',
  'Diya',
  'Ishaan',
  'Kavya',
  'Kabir',
  'Meera',
  'Mohammed',
  'Myra',
  'Om',
  'Prisha',
  'Rehan',
  'Riya',
  'Rudra',
  'Sana',
  'Shaurya',
  'Siya',
  'Tanmay',
  'Zoya',
  'Ved',
  'Avni',
  'Yash',
  'Aditi',
  'Arjun',
  'Fatima',
  'Neel',
  'Pihu',
  'Rohan',
  'Sakshi',
  'Vihaan',
  'Sara',
];
const lastNames = [
  'Deshmukh',
  'Patil',
  'Khan',
  'Meshram',
  'Sharma',
  'Wankhede',
  'Sheikh',
  'Joshi',
  'Kamble',
  'Verma',
  'Tayade',
  'Ali',
  'More',
  'Singh',
  'Borkar',
  'Ansari',
];
const subjects = [
  'Mathematics',
  'English',
  'Environmental Studies',
  'Marathi',
  'Hindi',
];
const books = [
  ['The Banyan Tree Mystery', 'Nandita Kulkarni', 'Fiction', 'English'],
  ['Chala Goshti Vachuya', 'Meenal Deshpande', 'Stories', 'Marathi'],
  ['Our Neighbourhood Birds', 'Arun Joshi', 'Nature', 'English'],
  ['Ganitachi Gammat', 'Savita Patil', 'Mathematics', 'Marathi'],
  ['Nanhe Vaigyanik', 'Renu Sharma', 'Science', 'Hindi'],
  ['The Little Seed', 'Farah Khan', 'Picture book', 'English'],
  ['Bharatache Samvidhan: Balmitra', 'Sanjay More', 'Civics', 'Marathi'],
  ['Khel Khel Mein Ganit', 'Rekha Verma', 'Mathematics', 'Hindi'],
  ['Water Around Us', 'Kiran Rao', 'Environment', 'English'],
  ['Mazi Pahili Kavita', 'Anjali Joshi', 'Poetry', 'Marathi'],
  ['Safar Sitaaron Ka', 'Saira Ali', 'Science', 'Hindi'],
  ['Stories from the School Garden', 'Deepa Borkar', 'Stories', 'English'],
];
export function sampleDay(day: string, offset: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
function enabled(origin: string, env: Record<string, string | undefined>) {
  if (
    origin === meetingOrigin &&
    env.RENDER === 'true' &&
    env.RENDER_EXTERNAL_URL?.replace(/\/$/, '') === meetingOrigin
  )
    return true;
  try {
    const url = new URL(origin);
    return (
      env.ERP_EXPANDED_DEMO === 'true' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Add fictional meeting content only to the exact, known sample installation.
 * Never replaces records, passwords, sessions, or submitted attendance.
 * New directory-only staff receive unguessable passwords, not a shared login.
 */
export async function seedExpandedDemo(
  db: Database,
  origin: string,
  env: Record<string, string | undefined> = process.env,
  today = todayInNagpur(),
) {
  if (!enabled(origin, env)) return 'not enabled';
  const tx = db;
  {
    const done = await one(
      tx,
      'SELECT id FROM school_activity WHERE id=?',
      marker,
    );
    const schools = await many<{ id: string; code: string; name: string }>(
      tx,
      'SELECT id,code,name FROM school',
    );
    const expected = [
      { id: 'school-a', code: 'DEMO-A', name: 'NMC Demo School A · Fictional' },
      { id: 'school-b', code: 'DEMO-B', name: 'NMC Demo School B · Fictional' },
      ...schoolNames.map((name, i) => ({
        id: `${prefix}school-${i + 2}`,
        code: `SS49-SAMPLE-${i + 3}`,
        name: `${name} · Fictional`,
      })),
    ];
    if (
      schools.length !== (done ? 8 : 2) ||
      schools.some(
        (s) =>
          !expected.some(
            (e) => e.id === s.id && e.code === s.code && e.name === s.name,
          ),
      )
    )
      return 'not sample fixture';
    const accounts = await many<{
      id: string;
      username: string;
      name: string;
      role: string;
    }>(tx, 'SELECT id,username,name,role FROM account');
    if (
      fictionalAccounts.some(
        ([id, name, role]) =>
          !accounts.some(
            (a) =>
              a.id === id &&
              a.username === id &&
              a.name === name &&
              a.role === role,
          ),
      )
    )
      return 'not sample fixture';
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
    const initialStudents = await many<{
      id: string;
      name: string;
      roll: string;
      class_id: string;
      effective_on: string;
    }>(tx, 'SELECT id,name,roll,class_id,effective_on FROM enrolment');
    if (
      ['a', 'b'].some(
        (suffix) =>
          initialStudents.find((s) => s.id === `class-${suffix}-student-1`)
            ?.name !== `Sample learner ${suffix.toUpperCase()}-1`,
      )
    )
      return 'not sample fixture';
    const initialClasses = await many<{
      id: string;
      school_id: string;
      effective_on: string;
    }>(tx, 'SELECT id,school_id,effective_on FROM class_section');
    const later = (a: string, b: string) => (a > b ? a : b);
    const existingOperations = new Map(
      (
        await many<{
          id: string;
          school_id: string;
          kind: string;
          record_key: string;
        }>(tx, 'SELECT id,school_id,kind,record_key FROM school_operation')
      ).map((o) => [`${o.school_id}:${o.kind}:${o.record_key}`, o.id]),
    );
    const staged = new Map<string, Record<string, string | number | null>[]>();
    const add = (
      table: string,
      values: Record<string, string | number | null>,
    ) => {
      const rows = staged.get(table) ?? [];
      rows.push(values);
      staged.set(table, rows);
    };
    const at = (offset = 0) => `${sampleDay(today, offset)}T09:30:00.000Z`;
    const activity = (
      id: string,
      school: string,
      actor: string,
      target: string,
      action: string,
      note: string,
      offset = 0,
    ) =>
      add('school_activity', {
        id,
        school_id: school,
        actor_id: actor,
        target_id: target,
        action,
        note,
        happened_at: at(offset),
      });
    if (!done) {
      for (const school of expected.slice(2)) add('school', school);
      const staff = (
        id: string,
        name: string,
        role: string,
        school: string,
      ) => {
        accountNames.set(id, name);
        add('account', {
          id,
          username: id,
          name,
          role,
          password_hash: passwordHash(randomBytes(32).toString('hex')),
        });
        add('school_assignment', { account_id: id, school_id: school });
        return id;
      };
      for (let si = 0; si < expected.length; si++) {
        const school = expected[si].id;
        const principal =
          si < 2
            ? `principal.${si === 0 ? 'a' : 'b'}`
            : staff(
                `${prefix}principal-${si}`,
                `${['Sunita Deshpande', 'Rajesh Wankhede', 'Farida Sheikh', 'Madhuri Joshi', 'Vijay Meshram', 'Nisha Borkar'][si - 2]} (Sample)`,
                'principal',
                school,
              );
        // A connected cluster gives the officer a useful comparison; the Commissioner sees all eight.
        const officer = si < 4 ? 'officer.a' : `${prefix}officer-${si}`;
        if (si > 0 && si < 4)
          add('school_assignment', { account_id: officer, school_id: school });
        if (si >= 4)
          staff(
            officer,
            `${['Anil Patil', 'Shabana Khan', 'Pravin Tayade', 'Seema More'][si - 4]} (Sample)`,
            'officer',
            school,
          );
        const librarian =
          si === 0
            ? 'library.a'
            : staff(
                `${prefix}librarian-${si}`,
                `${['Rekha', 'Pooja', 'Sameer', 'Asha', 'Imran', 'Geeta', 'Leena'][si - 1]} (Sample)`,
                'librarian',
                school,
              );
        const support =
          si === 0
            ? 'support.a'
            : staff(
                `${prefix}support-${si}`,
                `${['Mahesh', 'Ramesh', 'Suresh', 'Salim', 'Prakash', 'Sanjay', 'Deepak'][si - 1]} (Sample)`,
                'support',
                school,
              );
        const clerk =
          si === 0
            ? 'office.a'
            : staff(
                `${prefix}clerk-${si}`,
                `School records coordinator ${si + 1} (Sample)`,
                'clerk',
                school,
              );
        const accountant =
          si === 0
            ? 'accounts.a'
            : staff(
                `${prefix}accounts-${si}`,
                `Accounts coordinator ${si + 1} (Sample)`,
                'accountant',
                school,
              );
        const classIds =
          si === 0
            ? ['class-a', 'class-a-b']
            : si === 1
              ? ['class-b', `${prefix}class-1-b`]
              : [`${prefix}class-${si}-a`, `${prefix}class-${si}-b`];
        const students: {
          id: string;
          name: string;
          roll: string;
          class_id: string;
        }[] = [];
        const teachers: string[] = [];
        for (let ci = 0; ci < 2; ci++) {
          const classId = classIds[ci];
          const classStart =
            initialClasses.find((c) => c.id === classId)?.effective_on ??
            sampleDay(today, -60);
          if (!(si === 0 || (si === 1 && ci === 0)))
            add('class_section', {
              id: classId,
              school_id: school,
              grade: `Class ${si === 1 ? 6 : (si % 3) + 4}`,
              section: ci === 0 ? 'A' : 'B',
              effective_on: sampleDay(today, -60),
            });
          const teacher =
            ci === 0 && si < 2
              ? `teacher.${si === 0 ? 'a' : 'b'}`
              : staff(
                  `${prefix}teacher-${si}-${ci}`,
                  `${['Priya Kulkarni', 'Nilesh Meshram', 'Shweta Patil', 'Imran Sheikh', 'Pallavi Joshi', 'Sachin Borkar', 'Rashmi Verma', 'Anjali More'][si]} ${ci === 0 ? '' : 'B'} (Sample)`,
                  'teacher',
                  school,
                );
          teachers.push(teacher);
          if (!(ci === 0 && si < 2)) {
            add('class_assignment', { account_id: teacher, class_id: classId });
            for (let weekday = 1; weekday <= 5; weekday++)
              for (let period = 0; period < 3; period++)
                add('teaching_period', {
                  id: `${prefix}period-${si}-${ci}-${weekday}-${period}`,
                  teacher_id: teacher,
                  class_id: classId,
                  weekday,
                  start: `${9 + period}:00`.padStart(5, '0'),
                  end: `${9 + period}:40`.padStart(5, '0'),
                  subject: subjects[(period + weekday) % subjects.length],
                  room: `Room ${si + 1}${ci + 1}`,
                  version: 1,
                });
          }
          const current = initialStudents.filter((s) => s.class_id === classId);
          const maxRoll = current.reduce(
            (max, s) => Math.max(max, Number(s.roll) || 0),
            0,
          );
          const roster = [...current];
          for (let n = 0; n < 32; n++) {
            const student = {
              id: `${prefix}student-${si}-${ci}-${n}`,
              class_id: classId,
              name: `${firstNames[(n + si * 3 + ci * 7) % 32]} ${lastNames[(n * 3 + si + ci * 5) % 16]}`,
              roll: String(maxRoll + n + 1),
            };
            add('enrolment', {
              ...student,
              effective_on: classStart,
            });
            roster.push({ ...student, effective_on: classStart });
          }
          students.push(...roster);
          if (si < 2 && ci === 0)
            add('guardian_link', {
              account_id: `parent.${si === 0 ? 'a' : 'b'}`,
              enrolment_id: `${prefix}student-${si}-${ci}-0`,
            });
          for (let n = 0; n < roster.length; n++)
            for (let exam = 0; exam < 2; exam++)
              for (let subject = 0; subject < subjects.length; subject++) {
                const score =
                  38 +
                  ((n * 13 + si * 7 + ci * 3 + subject * 11) % 57) +
                  (exam === 1 ? 3 : 0);
                add('assessment', {
                  id: `${prefix}result-${si}-${ci}-${n}-${exam}-${subject}`,
                  student_id: roster[n].id,
                  subject: subjects[subject],
                  exam: exam === 0 ? 'Unit Test 1' : 'Term Progress Review',
                  day: later(
                    roster[n].effective_on,
                    sampleDay(today, exam === 0 ? -24 : -5),
                  ),
                  score,
                  maximum: 100,
                  feedback:
                    score < 55
                      ? 'Needs guided practice. Review two worked examples daily and check progress next week.'
                      : score < 75
                        ? 'Understands the basics. Explain each step and practise application questions.'
                        : 'Works independently and explains ideas clearly. Try the extension exercise.',
                  published: exam === 0 || n % 6 !== 0 ? 1 : 0,
                  author_id: teacher,
                  version: 1,
                });
              }
          for (let h = 0; h < 6; h++) {
            const id = `${prefix}homework-${si}-${ci}-${h}`;
            add('homework', {
              id,
              class_id: classId,
              subject: subjects[h % 5],
              title: [
                'Fractions in everyday shopping',
                'Read and retell a short story',
                'Our water use diary',
                'Write about a community helper',
                'Vocabulary and sentence practice',
                'Maths revision worksheet',
              ][h],
              body: [
                'Draw a shopping list with half and quarter quantities. Show four fraction comparisons.',
                'Read one library story. Write five sentences about the main character and a different ending.',
                'Observe water use at home for two days. List three ways to reduce waste.',
                'Write eight sentences about someone who helps your neighbourhood. Include a labelled drawing.',
                'Use ten new words in meaningful sentences. Underline the naming and action words.',
                'Complete questions 1–12. Show your working and mark the two questions you found hardest.',
              ][h],
              due: later(classStart, sampleDay(today, h * 3 - 10)),
              happened_at:
                later(classStart, sampleDay(today, h * 2 - 17)) +
                'T09:30:00.000Z',
              author_id: teacher,
              version: 1,
            });
            if (h < 4)
              for (let n = 0; n < roster.length; n++)
                if ((n + h) % 5 !== 0)
                  add('homework_submission', {
                    homework_id: id,
                    student_id: roster[n].id,
                    note: 'Completed the exercise in my notebook and checked the answers.',
                    feedback:
                      n % 4 === 0
                        ? ''
                        : n % 3 === 0
                          ? 'Please correct question 3 and show your working.'
                          : 'Good effort. Your explanation is clear.',
                    happened_at:
                      later(
                        classStart,
                        sampleDay(today, Math.min(-1, h * 3 - 11)),
                      ) + 'T10:30:00.000Z',
                    version: 1,
                  });
          }
        }
        const schoolStaff = [
          ...teachers,
          principal,
          librarian,
          support,
          clerk,
          accountant,
        ];
        const operation = (
          suffix: string,
          kind: string,
          status: string,
          data: Record<string, string | number>,
          actor = principal,
          offset = -2,
        ) => {
          const id = `${prefix}op-${si}-${suffix}`;
          const key =
            kind === 'staff-attendance'
              ? `${data.staffId}:${data.day}`
              : kind === 'payroll'
                ? `${data.staffId}:${data.month}`
                : ['grant', 'expense'].includes(kind)
                  ? String(data.reference).toLowerCase()
                  : kind === 'inventory'
                    ? String(data.code).toLowerCase()
                    : id;
          const existing = existingOperations.get(`${school}:${kind}:${key}`);
          if (existing) return existing;
          add('school_operation', {
            id,
            school_id: school,
            kind,
            record_key: key,
            status,
            data: JSON.stringify(data),
            author_id: actor,
            happened_at: at(offset),
            version: ['approved', 'declined'].includes(status) ? 2 : 1,
          });
          activity(
            `${id}-activity`,
            school,
            actor,
            id,
            `operations ${kind}`,
            JSON.stringify({ before: null, after: { status } }),
            offset,
          );
          return id;
        };
        for (let n = 0; n < schoolStaff.length; n++) {
          const staffId = schoolStaff[n];
          const staffName = accountNames.get(staffId)!;
          operation(
            `staff-${n}`,
            'staff-attendance',
            n === 4 ? 'leave' : n === 1 && si % 3 === 0 ? 'absent' : 'present',
            {
              staffId,
              staffName,
              day: today,
              note:
                n === 4
                  ? 'Approved personal leave; classroom readiness reassigned.'
                  : 'Morning attendance recorded by the school office.',
            },
            clerk,
            0,
          );
          operation(
            `payroll-${n}`,
            'payroll',
            n % 3 === 0 ? 'draft' : 'approved',
            {
              staffId,
              staffName,
              month: today.slice(0, 7),
              gross: 2800000 + n * 450000,
              deductions: 180000 + n * 15000,
              net: 2620000 + n * 435000,
              note: 'Monthly salary statement; statutory deductions included.',
            },
            accountant,
          );
          operation(
            `leave-${n}`,
            'leave',
            n % 3 === 0 ? 'pending' : n % 3 === 1 ? 'approved' : 'declined',
            {
              staffId,
              staffName,
              start: n === 4 ? today : sampleDay(today, 3 + n),
              end: n === 4 ? today : sampleDay(today, 4 + n),
              reason:
                n % 2
                  ? 'Family appointment; lesson cover arranged.'
                  : 'Personal leave requested with handover notes.',
              decisionNote:
                n % 3 === 2
                  ? 'Please reschedule because assessment supervision is already assigned.'
                  : n % 3 === 1
                    ? 'Cover arrangements confirmed.'
                    : '',
            },
            staffId,
          );
        }
        for (let n = 0; n < 7; n++)
          operation(
            `admission-${n}`,
            'admission',
            n < 6 ? 'pending' : 'declined',
            {
              name: `${firstNames[(n * 3 + si) % 32]} ${lastNames[(n + si + 4) % 16]}`,
              guardian: `Guardian ${lastNames[(n + si + 4) % 16]}`,
              contact: `guardian-${si}-${n}@example.invalid`,
              classId: classIds[n % 2],
              day: sampleDay(today, -9 + n),
              note:
                n < 4
                  ? 'Transfer record received; address verification pending.'
                  : 'Application reviewed at the school office.',
              decisionNote:
                n === 6
                  ? 'Incomplete age and transfer documentation; family asked to reapply.'
                  : n > 3
                    ? 'Documents verified. Principal approval pending.'
                    : '',
            },
            clerk,
          );
        for (let n = 0; n < 3; n++) {
          const grant = operation(
            `grant-${n}`,
            'grant',
            'recorded',
            {
              title: [
                'School development grant',
                'Learning materials grant',
                'Library enrichment grant',
              ][n],
              reference: `SAMPLE-GR-${si + 1}-${n + 1}`,
              amount: [25000000, 12000000, 8000000][n],
              day: sampleDay(today, -30),
              note: 'Illustrative allocation for the current term.',
            },
            accountant,
            -30,
          );
          for (let e = 0; e < 3; e++)
            operation(
              `expense-${n}-${e}`,
              'expense',
              'recorded',
              {
                grantId: grant,
                title: [
                  [
                    'Classroom bench repairs',
                    'Drinking water servicing',
                    'Electrical safety inspection',
                  ],
                  [
                    'Maths activity kits',
                    'Science demonstration materials',
                    'Exercise books',
                  ],
                  [
                    'Bilingual reading books',
                    'Book binding and repairs',
                    'Reading corner shelving',
                  ],
                ][n][e],
                amount: 1200000 + e * 180000 + si * 10000,
                day: sampleDay(today, -20 + e * 4),
                reference: `SAMPLE-INV-${si}-${n}-${e}`,
                note: 'Illustrative invoice verified against received supplies.',
              },
              accountant,
              -20 + e * 4,
            );
        }
        for (let n = 0; n < 6; n++) {
          const item = operation(
            `stock-${n}`,
            'inventory',
            'recorded',
            {
              title: [
                'Exercise notebooks',
                'Whiteboard markers',
                'Cleaning liquid',
                'Sports cones',
                'First-aid dressings',
                'Chalk boxes',
              ][n],
              code: `SAMPLE-ST-${si}-${n}`,
              unit: [
                'notebooks',
                'markers',
                'litres',
                'cones',
                'packs',
                'boxes',
              ][n],
              quantity: n === 4 ? 0 : 40 + n * 10,
              note: 'Opening stock counted and entered by the school team.',
            },
            support,
            -20,
          );
          if (n !== 4) {
            operation(
              `receive-${n}`,
              'movement',
              'recorded',
              {
                itemId: item,
                title: [
                  'Exercise notebooks',
                  'Whiteboard markers',
                  'Cleaning liquid',
                  'Sports cones',
                  'First-aid dressings',
                  'Chalk boxes',
                ][n],
                direction: 'receive',
                quantity: 20,
                day: sampleDay(today, -12),
                note: 'Delivered to the school stores; quantity checked.',
              },
              support,
              -12,
            );
            operation(
              `issue-${n}`,
              'movement',
              'recorded',
              {
                itemId: item,
                title: [
                  'Exercise notebooks',
                  'Whiteboard markers',
                  'Cleaning liquid',
                  'Sports cones',
                  'First-aid dressings',
                  'Chalk boxes',
                ][n],
                direction: 'issue',
                quantity: 15 + n,
                day: sampleDay(today, -4),
                note: 'Issued for classroom and school operations.',
              },
              support,
              -4,
            );
          }
        }
        for (let n = 0; n < 5; n++) {
          operation(
            `calendar-${n}`,
            'calendar',
            'scheduled',
            {
              title: [
                'Parent–teacher progress meetings',
                'Term assessment week',
                'School reading festival',
                'Teacher development workshop',
                'Inter-class sports morning',
              ][n],
              start: sampleDay(today, 2 + n * 3),
              end: sampleDay(today, 2 + n * 3 + (n === 1 ? 4 : 0)),
              audience: n === 3 ? 'staff' : 'all',
              category:
                n === 0 || n === 3 ? 'meeting' : n === 1 ? 'exam' : 'activity',
              note: [
                'Families meet class teachers in allocated 15-minute slots. Bring the progress notebook.',
                'Subject-wise timetable will be shared by the class teacher.',
                'Bring a favourite story and take part in paired reading.',
                'Staff review assessment evidence and plan targeted support.',
                'House teams rotate through running, relay and team games.',
              ][n],
            },
            principal,
            0,
          );
          add('school_notice', {
            id: `${prefix}notice-${si}-${n}`,
            school_id: school,
            title: [
              'Progress meeting schedule',
              'Bring a reusable water bottle',
              'Library reading challenge',
              'Assessment preparation guidance',
              'School safety walk',
            ][n],
            body: [
              'Please check your child’s class slot and prepare questions about learning progress.',
              'The school has serviced its drinking water points. Encourage children to refill their bottles.',
              'Read three books this month and share a short review with your class.',
              'Revise in short daily sessions. Teachers will share practice worksheets this week.',
              'The school team will check corridors, drinking water points and classroom furniture.',
            ][n],
            audience: n === 4 ? 'staff' : n === 0 ? 'parents' : 'all',
            author_id: principal,
            happened_at: at(-n),
          });
        }
        for (const [index, assignee] of [
          clerk,
          accountant,
          librarian,
          support,
        ].entries())
          for (let t = 0; t < 4; t++)
            add('staff_task', {
              id: `${prefix}task-${si}-${index}-${t}`,
              school_id: school,
              assigned_to: assignee,
              title: [
                [
                  'Verify transfer certificates',
                  'Update admission register',
                  'Prepare enrolment summary',
                  'Check guardian contact records',
                ],
                [
                  'Reconcile grant expenditure',
                  'Attach invoice references',
                  'Review salary deductions',
                  'Prepare budget utilisation summary',
                ],
                [
                  'Follow up overdue books',
                  'Repair damaged bindings',
                  'Arrange bilingual reading display',
                  'Complete shelf stock check',
                ],
                [
                  'Check water filter service date',
                  'Inspect classroom furniture',
                  'Replenish cleaning supplies',
                  'Complete corridor safety check',
                ],
              ][index][t],
              body: 'Complete the checklist, record exceptions and send the outcome to the principal.',
              status: t === 3 ? 'completed' : 'open',
              note:
                t === 3
                  ? 'Checklist completed; no outstanding exceptions.'
                  : '',
              version: t === 3 ? 2 : 1,
            });
        if (si < 2)
          for (let r = 0; r < 5; r++)
            add('school_request', {
              id: `${prefix}family-request-${si}-${r}`,
              school_id: school,
              account_id: `parent.${si === 0 ? 'a' : 'b'}`,
              enrolment_id: `${prefix}student-${si}-0-0`,
              category: ['general', 'leave', 'library', 'general', 'leave'][r],
              title: [
                'Request a progress meeting',
                'Family appointment leave',
                'Reading book recommendation',
                'Update collection arrangements',
                'Medical appointment follow-up',
              ][r],
              body: [
                'Please suggest a time to discuss reading progress and mathematics practice.',
                'My child has a family appointment. Please share the missed classwork.',
                'Could you recommend a suitable bilingual story book for home reading?',
                'A guardian will collect the child after the scheduled parent meeting.',
                'The appointment is complete. We have collected the missed worksheet.',
              ][r],
              status: r < 3 ? 'open' : 'resolved',
              response:
                r < 3
                  ? ''
                  : r === 3
                    ? 'Please confirm the authorised guardian at the office.'
                    : 'Thank you. Please submit the completed worksheet on the next school day.',
              happened_at: at(-r - 1),
              version: r < 3 ? 1 : 2,
            });
        for (let b = 0; b < books.length; b++) {
          const bookId = `${prefix}book-${si}-${b}`;
          add('library_book', {
            id: bookId,
            school_id: school,
            code: `SAMPLE-BK-${b + 1}`,
            title: books[b][0],
            author: books[b][1],
            category: books[b][2],
            language: books[b][3],
            isbn: '',
            shelf: `${b < 6 ? 'A' : 'B'}-${(b % 6) + 1}`,
            version: 1,
          });
          for (let c = 0; c < 3; c++) {
            const copy = `${bookId}-copy-${c}`;
            add('library_copy', {
              id: copy,
              school_id: school,
              book_id: bookId,
              accession: `SAMPLE-${si + 1}-${b + 1}-${c + 1}`,
              state:
                c === 2 && b === 10
                  ? 'damaged'
                  : c === 2 && b === 11
                    ? 'lost'
                    : 'active',
              version: c === 2 && b >= 10 ? 2 : 1,
            });
            if (c === 0 || (c === 1 && b % 2 === 0) || (c === 2 && b >= 10)) {
              const closed = c !== 0;
              const student = students[(b * 3 + c) % students.length];
              add('library_loan', {
                id: `${copy}-loan`,
                school_id: school,
                copy_id: copy,
                student_id: student.id,
                issued_on: later(
                  initialStudents.find((s) => s.id === student.id)
                    ?.effective_on ??
                    initialClasses.find((c) => c.id === student.class_id)
                      ?.effective_on ??
                    sampleDay(today, -60),
                  sampleDay(today, -18 + (b % 5)),
                ),
                due_on: later(
                  sampleDay(
                    initialStudents.find((s) => s.id === student.id)
                      ?.effective_on ??
                      initialClasses.find((c) => c.id === student.class_id)
                        ?.effective_on ??
                      sampleDay(today, -60),
                    7,
                  ),
                  sampleDay(today, b % 3 === 0 ? -4 : 4 + (b % 4)),
                ),
                closed_on: closed
                  ? later(
                      initialStudents.find((s) => s.id === student.id)
                        ?.effective_on ??
                        initialClasses.find((c) => c.id === student.class_id)
                          ?.effective_on ??
                        sampleDay(today, -60),
                      sampleDay(today, -2),
                    )
                  : null,
                outcome: closed
                  ? c === 2
                    ? b === 10
                      ? 'damaged'
                      : 'lost'
                    : 'returned'
                  : null,
                issue_note:
                  'Class reading programme; return date explained to the learner.',
                close_note: closed
                  ? c === 2
                    ? 'Condition exception recorded; guardian follow-up requested.'
                    : 'Returned and checked at the library desk.'
                  : '',
                issuer_id: librarian,
                closer_id: closed ? librarian : null,
                version: closed ? 2 : 1,
              });
            }
          }
        }
        for (const [n, category] of [
          'finance',
          'library',
          'maintenance',
        ].entries())
          add('school_request', {
            id: `${prefix}staff-request-${si}-${n}`,
            school_id: school,
            account_id: teachers[0],
            enrolment_id: null,
            category,
            title: [
              'Classroom activity kit budget',
              'Additional bilingual reading books',
              'Repair classroom cupboard hinge',
            ][n],
            body: [
              'Please confirm the available materials budget before placing the activity kit request.',
              'The paired reading group needs six additional copies suitable for early readers.',
              'The cupboard door does not close securely. Please inspect the hinge before the next class.',
            ][n],
            status: 'open',
            response: '',
            happened_at: at(-2),
            version: 1,
          });
        for (let r = 0; r < 6; r++) {
          const status = [
            'open',
            'assigned',
            'in-progress',
            'blocked',
            'reported',
            'closed',
          ][r];
          add('maintenance_ticket', {
            id: `${prefix}repair-${si}-${r}`,
            school_id: school,
            title: [
              'Loose classroom window latch',
              'Water filter service',
              'Classroom bench repair',
              'Corridor light replacement',
              'Playground gate hinge',
              'Library shelf fixing',
            ][r],
            category: [
              'general',
              'water',
              'furniture',
              'electrical',
              'safety',
              'furniture',
            ][r],
            location: [
              'Classroom A',
              'Drinking water point',
              'Classroom B',
              'First-floor corridor',
              'Playground entrance',
              'Library reading corner',
            ][r],
            priority: r === 1 ? 'urgent' : r === 3 ? 'high' : 'normal',
            status,
            reporter_id: teachers[0],
            assignee_id: r === 0 ? null : support,
            due: sampleDay(today, r === 3 ? -2 : r + 1),
            details:
              'Inspection identified wear affecting normal school use. Please record the repair and check the area before reopening.',
            progress:
              r < 2
                ? ''
                : r === 3
                  ? 'Replacement fitting requested; awaiting supplier delivery.'
                  : 'Repair work completed or underway; progress photographs to be reviewed on site.',
            verification:
              r === 5
                ? 'Principal inspected the fixing and confirmed the area is safe for use.'
                : '',
            request_id: null,
            created_at: at(-10 + r),
            version: r === 0 ? 1 : r === 5 ? 4 : 2,
          });
        }
        for (let r = 0; r < 6; r++)
          activity(
            `${prefix}repair-activity-${si}-${r}`,
            school,
            r === 5 ? principal : support,
            `${prefix}repair-${si}-${r}`,
            'maintenance sample case',
            r === 5
              ? 'Principal verified the repair and accepted closure.'
              : r === 3
                ? 'Awaiting a replacement fitting from the supplier.'
                : 'School inspection and repair progress recorded.',
            -4,
          );
        for (let n = 0; n < 4; n++) {
          const data = {
            title: [
              'Teaching and learning review',
              'Reading corner inspection',
              'Attendance follow-up visit',
              'School readiness review',
            ][n],
            visitDate: sampleDay(today, n === 0 ? 5 : -12 + n),
            note: 'Review classroom routines, learning evidence and outstanding school actions.',
            ...(n > 0
              ? {
                  findings:
                    'Reading practice is regular. Targeted support and classroom resource replenishment need follow-up.',
                  visitedOn: sampleDay(today, -12 + n),
                  due: sampleDay(today, 4 + n),
                  requiredAction:
                    'Submit the support-group timetable and confirm the material delivery.',
                }
              : {}),
            ...(n > 1
              ? {
                  response:
                    'Support groups started; timetable shared and reading materials received.',
                }
              : {}),
            ...(n === 3
              ? {
                  verification:
                    'Officer reviewed the timetable and checked materials during the follow-up visit.',
                }
              : {}),
            updatedBy: officer,
            updatedAt: at(-4 + n),
          };
          const id = `${prefix}inspection-${si}-${n}`;
          add('education_record', {
            id,
            school_id: school,
            kind: 'inspection',
            status: ['planned', 'visited', 'responded', 'closed'][n],
            data: JSON.stringify(data),
            author_id: officer,
            happened_at: at(-12),
            version: n + 1,
          });
          activity(
            `${id}-activity`,
            school,
            officer,
            id,
            'oversight inspection recorded',
            'School visit and follow-up recorded.',
            -4 + n,
          );
        }
        for (let n = 0; n < 4; n++) {
          const request = `${prefix}education-request-${si}-${n}`;
          add('education_record', {
            id: request,
            school_id: school,
            kind: 'request',
            status: ['submitted', 'under-review', 'escalated', 'resolved'][n],
            data: JSON.stringify({
              title: [
                'Additional teaching materials',
                'Learning support staffing',
                'Classroom repair allocation',
                'Reading programme approval',
              ][n],
              category: ['academics', 'staffing', 'maintenance', 'general'][n],
              priority: n === 2 ? 'high' : 'normal',
              note: 'School evidence and estimated quantities are ready for review.',
              ...(n > 0
                ? {
                    review:
                      'School need verified against current enrolment and available resources.',
                  }
                : {}),
              ...(n > 1
                ? {
                    decision:
                      n === 2
                        ? 'Technical estimate requested from the appropriate department.'
                        : 'Approved within the school activity plan; principal informed.',
                  }
                : {}),
              updatedBy: officer,
              updatedAt: at(-n),
            }),
            author_id: principal,
            happened_at: at(-8),
            version: n + 1,
          });
          add('education_record', {
            id: `${prefix}circular-${si}-${n}`,
            school_id: school,
            kind: 'circular',
            status: ['issued', 'acknowledged', 'reported', 'closed'][n],
            data: JSON.stringify({
              title: [
                'Monthly attendance review',
                'School safety checklist',
                'Library reading programme',
                'Term progress reporting',
              ][n],
              due: sampleDay(today, n === 0 ? -1 : 5 + n),
              note: 'Submit the school action summary and note any unresolved dependencies.',
              ...(n > 0
                ? {
                    acknowledgement:
                      'Received and assigned to the school coordination team.',
                  }
                : {}),
              ...(n > 1
                ? {
                    compliance:
                      'Checklist completed and reviewed by the principal.',
                  }
                : {}),
              ...(n === 3
                ? {
                    verification:
                      'Education officer accepted the school compliance summary.',
                  }
                : {}),
              updatedBy: officer,
              updatedAt: at(-n),
            }),
            author_id: officer,
            happened_at: at(-10),
            version: n + 1,
          });
          add('municipal_priority', {
            id: `${prefix}priority-${si}-${n}`,
            school_id: school,
            officer_id: officer,
            title: [
              'Improve attendance follow-up',
              'Strengthen foundational reading',
              'Resolve school infrastructure issues',
              'Complete school resource verification',
            ][n],
            category: [
              'governance',
              'academics',
              'infrastructure',
              'governance',
            ][n],
            priority: n === 0 ? 'high' : 'normal',
            due: sampleDay(today, n === 0 ? -2 : 7 + n),
            status: ['assigned', 'in-progress', 'reported', 'closed'][
              (n + si) % 4
            ],
            instructions:
              'Coordinate with the principal, verify school evidence and report a measurable outcome.',
            progress:
              (n + si) % 4 === 0
                ? ''
                : 'School review completed. Family outreach and classroom support actions are being tracked.',
            verification:
              (n + si) % 4 === 3
                ? 'Commissioner reviewed the officer summary and accepted closure.'
                : '',
            author_id: 'commissioner',
            happened_at: at(-14),
            version: ((n + si) % 4) + 1,
          });
        }
      }
      for (let si = 0; si < expected.length; si++)
        for (let n = 0; n < 4; n++)
          activity(
            `${prefix}priority-activity-${si}-${n}`,
            expected[si].id,
            'commissioner',
            `${prefix}priority-${si}-${n}`,
            'municipal sample priority',
            'School improvement priority and officer follow-up recorded.',
            -7,
          );
      activity(
        marker,
        'school-a',
        'admin',
        marker,
        'sample content added',
        'Fictional school-network scenarios added without changing existing records or credentials.',
      );
    }
    // Keep a dated walkthrough snapshot on startup. A register already entered by
    // a user always wins; historical data is seeded only once. Weekend snapshots
    // are explicitly labelled as meeting scenarios, not normal school sessions.
    const classes = [
      ...initialClasses,
      ...(staged.get('class_section') ?? []).map((c) => ({
        id: String(c.id),
        school_id: String(c.school_id),
        effective_on: String(c.effective_on),
      })),
    ];
    const days = done
      ? [today]
      : Array.from({ length: 28 }, (_, i) => sampleDay(today, i - 28))
          .filter(
            (d) => ![0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay()),
          )
          .concat(today);
    const allStudents = [
      ...initialStudents,
      ...(staged.get('enrolment') ?? []).map((s) => ({
        id: String(s.id),
        name: String(s.name),
        roll: String(s.roll),
        class_id: String(s.class_id),
        effective_on: String(s.effective_on),
      })),
    ].sort(
      (a, b) => Number(a.roll) - Number(b.roll) || a.id.localeCompare(b.id),
    );
    const classTeachers = await many<{
      id: string;
      name: string;
      class_id: string;
    }>(
      tx,
      "SELECT a.id,a.name,c.class_id FROM account a JOIN class_assignment c ON c.account_id=a.id WHERE a.role='teacher' ORDER BY a.id",
    );
    const principals = await many<{
      id: string;
      name: string;
      school_id: string;
    }>(
      tx,
      "SELECT a.id,a.name,s.school_id FROM account a JOIN school_assignment s ON s.account_id=a.id WHERE a.role='principal' ORDER BY a.id",
    );
    for (const assignment of staged.get('class_assignment') ?? [])
      classTeachers.push({
        id: String(assignment.account_id),
        name: accountNames.get(String(assignment.account_id))!,
        class_id: String(assignment.class_id),
      });
    const addedPrincipals = new Set(
      (staged.get('account') ?? [])
        .filter((a) => a.role === 'principal')
        .map((a) => String(a.id)),
    );
    for (const assignment of staged.get('school_assignment') ?? [])
      if (addedPrincipals.has(String(assignment.account_id)))
        principals.push({
          id: String(assignment.account_id),
          name: accountNames.get(String(assignment.account_id))!,
          school_id: String(assignment.school_id),
        });
    const existingRegisters = new Set(
      (
        await many<{ class_id: string; day: string }>(
          tx,
          'SELECT class_id,day FROM register WHERE day>=? AND day<=?',
          sampleDay(today, -28),
          today,
        )
      ).map((r) => r.class_id + ':' + r.day),
    );
    for (const [ci, cls] of classes.entries()) {
      const teacher = classTeachers.find((t) => t.class_id === cls.id);
      const principal = principals.find((p) => p.school_id === cls.school_id);
      if (!teacher || !principal) continue;
      if (
        !['class-a', 'class-a-b', 'class-b'].includes(cls.id) &&
        !/^ss49-sample-class-[1-7]-[ab]$/.test(cls.id)
      )
        continue;
      if (
        allStudents.some(
          (s) =>
            s.class_id === cls.id &&
            !s.id.startsWith(prefix) &&
            !/^class-(a|a-b|b)-student-\d+$/.test(s.id),
        )
      )
        continue;
      for (const [di, day] of days.entries()) {
        if (existingRegisters.has(cls.id + ':' + day)) continue;
        // A few unsubmitted historic classes create a credible coverage gap.
        if (day !== today && (di + ci * 3) % 19 === 0) continue;
        const roster = allStudents
          .filter((s) => s.class_id === cls.id && s.effective_on <= day)
          .map(({ id, name, roll }) => ({ id, name, roll }));
        if (!roster.length) continue;
        const entries = JSON.stringify(
          roster.map((s, n) => ({
            ...s,
            mark:
              (n * 7 + ci * 3 + di * 5) % 29 < 2
                ? 'absent'
                : (n * 7 + ci * 3 + di * 5) % 29 === 2
                  ? 'leave'
                  : 'present',
          })),
        );
        const status =
          (di + ci) % 13 === 0
            ? 'returned'
            : (di + ci) % 3 === 0
              ? 'reviewed'
              : 'submitted';
        const id = `${prefix}register-${cls.id}-${day}`;
        add('register', {
          id,
          class_id: cls.id,
          day,
          status,
          version: status === 'submitted' ? 1 : 2,
          entries,
        });
        add('register_event', {
          register_id: id,
          version: 1,
          actor_id: teacher.id,
          actor_name: teacher.name,
          action: 'submitted',
          happened_at: `${day}T04:45:00.000Z`,
          note:
            day === today
              ? 'Fictional meeting walkthrough snapshot; this may fall outside the normal school calendar.'
              : 'Morning attendance; approved leave checked against family requests.',
          changed_marks: 0,
          entries,
        });
        if (status !== 'submitted')
          add('register_event', {
            register_id: id,
            version: 2,
            actor_id: principal.id,
            actor_name: principal.name,
            action: status,
            happened_at: `${day}T07:00:00.000Z`,
            note:
              status === 'returned'
                ? 'Please verify absence information with the class teacher before resubmitting.'
                : 'Class roster and leave entries checked.',
            changed_marks: 0,
            entries,
          });
      }
    }
    const groups: SampleGroup[] = [];
    // Bulk insert rows by dependency order. JSON-bound rows keep the hosted
    // request compact and avoid thousands of individual protocol batch steps.
    for (const table of [
      'school',
      'account',
      'school_assignment',
      'class_section',
      'class_assignment',
      'enrolment',
      'guardian_link',
      'teaching_period',
      'assessment',
      'homework',
      'homework_submission',
      'school_notice',
      'school_request',
      'staff_task',
      'school_operation',
      'library_book',
      'library_copy',
      'library_loan',
      'education_record',
      'municipal_priority',
      'maintenance_ticket',
      'register',
      'register_event',
      'school_activity',
    ]) {
      const rows = staged.get(table);
      if (!rows?.length) continue;
      groups.push({ table, rows });
    }
    if (groups.length) {
      // Revalidate fixture identities and roster snapshots inside the same
      // server-side batch as the inserts, so preparation cannot race with edits.
      const guard = (
        table: string,
        rows: unknown[],
        columns: string[],
      ): InStatement => ({
        sql: `SELECT CASE WHEN (SELECT COUNT(*) FROM ${table})=? AND NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE NOT EXISTS (SELECT 1 FROM ${table} r WHERE ${columns.map((c) => `r.${c}=json_extract(j.value,'$.${c}')`).join(' AND ')})) THEN 1 ELSE json('sample fixture changed during preparation') END`,
        args: [rows.length, JSON.stringify(rows)],
      });
      await commitSampleGroups(db, groups, [
        guard('school', schools, ['id', 'code', 'name']),
        guard('account', accounts, ['id', 'username', 'name', 'role']),
        guard('class_section', initialClasses, [
          'id',
          'school_id',
          'effective_on',
        ]),
        guard('enrolment', initialStudents, [
          'id',
          'class_id',
          'name',
          'roll',
          'effective_on',
        ]),
      ]);
    }
    return done ? 'already expanded' : 'expanded';
  }
}
