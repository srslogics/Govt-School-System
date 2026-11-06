import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  configuredDatabase,
  initializeDatabase,
  openFileDatabase,
} from '../lib/erp/database';
import { createHandler } from '../lib/erp/http';
import {
  attendanceRate,
  todayInNagpur,
  type RegisterView,
  type Report,
  type Setup,
  type Workspace,
} from '../lib/erp/model';
import { seedFictionalSchools } from '../lib/erp/seed';

const password = 'FictionalTestOnly-6273';
const day = todayInNagpur();
const register = (id: string) => `register/${id}/${day}`;
const report = `report?date=${day}`;

async function start(path: string) {
  const db = openFileDatabase(path);
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.on('end', () => {
      const url = new URL(incoming.url ?? '/', origin);
      const request = new Request(url, {
        method: incoming.method,
        headers: new Headers(
          Object.entries(incoming.headers).flatMap<[string, string]>(
            ([key, value]) =>
              value === undefined
                ? []
                : [[key, Array.isArray(value) ? value.join(', ') : value]],
          ),
        ),
        body:
          incoming.method === 'POST'
            ? Buffer.concat(chunks).toString()
            : undefined,
      });
      void handler(request)
        .then(async (response) => {
          outgoing.writeHead(
            response.status,
            Object.fromEntries(response.headers),
          );
          outgoing.end(await response.text());
        })
        .catch(() => {
          outgoing.writeHead(500).end();
        });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const handler = createHandler(db, origin);
  return {
    origin,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => {
          db.close();
          if (error) reject(error);
          else resolve();
        }),
      ),
  };
}

function client(origin: string, priorCookie = '') {
  let cookie = priorCookie;
  async function call(
    path: string,
    body?: Record<string, unknown>,
    from = origin,
  ) {
    return fetch(`${origin}/api/erp/${path}`, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { origin: from, 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    });
  }
  return {
    call,
    cookie: () => cookie,
    async login(username: string, secret = password) {
      const response = await call('login', { username, password: secret });
      assert.equal(response.status, 200);
      const header = response.headers.get('set-cookie') ?? '';
      assert.match(header, /HttpOnly; SameSite=Strict/);
      cookie = header.split(';')[0];
    },
  };
}

void test('Render requires a TLS-protected shared database and never falls back to a local file', () => {
  assert.throws(
    () => configuredDatabase({ RENDER: 'true', ERP_DB_PATH: 'pilot.sqlite' }),
    /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/,
  );
  assert.throws(
    () =>
      configuredDatabase({
        TURSO_DATABASE_URL: 'libsql://example.invalid:80?tls=0',
        TURSO_AUTH_TOKEN: 'test-token',
      }),
    /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/,
  );
});

void test('shared HTTP attendance, isolation, weighted reporting and audit history survive restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'shiksha-erp-test-'));
  const path = join(directory, 'pilot.sqlite');
  const seed = openFileDatabase(path);
  await initializeDatabase(seed);
  await seedFictionalSchools(seed, () => password);
  seed.close();
  let service = await start(path);
  try {
    const anonymous = client(service.origin);
    const teacherA = client(service.origin);
    const principalA = client(service.origin);
    const teacherB = client(service.origin);
    const principalB = client(service.origin);
    const commissioner = client(service.origin);
    const officer = client(service.origin);
    const administrator = client(service.origin);
    assert.equal((await anonymous.call(register('class-a'))).status, 401);
    assert.equal(
      (
        await anonymous.call('login', {
          username: 'teacher.a',
          password: 'Nagpur@2026',
        })
      ).status,
      401,
    );
    await teacherA.login('teacher.a');
    await teacherB.login('teacher.b');
    await principalA.login('principal.a');
    await principalB.login('principal.b');
    await commissioner.login('commissioner');
    await officer.login('officer.a');
    await administrator.login('admin');
    assert.notEqual(teacherA.cookie(), principalA.cookie());

    const scope = (await (await teacherA.call('session')).json()) as Workspace;
    assert.deepEqual(
      scope.classes.map((row) => row.id),
      ['class-a'],
    );
    const before = (await (await principalA.call(report)).json()) as Report;
    assert.equal(before.totals.missing, 2);
    assert.equal(attendanceRate(before.totals), '—');
    assert.equal(before.schools[0].classes?.[0].status, 'not submitted');
    const a = (await (
      await teacherA.call(register('class-a'))
    ).json()) as RegisterView;
    const aMarks = Object.fromEntries(
      a.roster.map((student, index) => [
        student.id,
        index < 2 ? 'present' : 'leave',
      ]),
    );
    const submit = { action: 'submit', version: 0, marks: aMarks };
    assert.equal(
      (
        await teacherA.call(
          register('class-a'),
          submit,
          'https://elsewhere.invalid',
        )
      ).status,
      403,
    );
    assert.equal(
      (await teacherA.call(register('class-a'), { ...submit, marks: {} }))
        .status,
      400,
    );
    const duplicate = await Promise.all([
      teacherA.call(register('class-a'), submit),
      teacherA.call(register('class-a'), submit),
    ]);
    assert.deepEqual(
      duplicate.map((res) => res.status).sort((a, b) => a - b),
      [200, 409],
    );
    const seen = (await (
      await principalA.call(register('class-a'))
    ).json()) as RegisterView;
    assert.equal(seen.register?.status, 'submitted');
    assert.equal(seen.register?.entries.length, 3);
    assert.equal(seen.history[0].actor, 'Demo Teacher A');

    for (const other of [teacherB, principalB, officer, commissioner]) {
      assert.equal((await other.call(register('class-a'))).status, 404);
      assert.equal(
        (
          await other.call(register('class-a'), {
            action: 'return',
            version: 1,
            note: 'Spoofed',
          })
        ).status,
        404,
      );
    }
    assert.equal((await teacherA.call(register('class-a-b'))).status, 404);
    assert.equal(
      (
        await teacherA.call(register('class-a'), {
          action: 'review',
          version: 1,
        })
      ).status,
      403,
    );
    assert.equal(
      (await principalB.call(`${report}&school=school-a&format=csv`)).status,
      404,
    );
    assert.equal((await teacherA.call(`${report}&format=csv`)).status, 403);
    assert.equal((await officer.call(`${report}&school=school-b`)).status, 404);
    assert.equal((await principalA.call('setup')).status, 403);

    const b = (await (
      await teacherB.call(register('class-b'))
    ).json()) as RegisterView;
    const bMarks = Object.fromEntries(
      b.roster.map((student) => [student.id, 'absent']),
    );
    assert.equal(
      (
        await teacherB.call(register('class-b'), {
          action: 'submit',
          version: 0,
          marks: bMarks,
        })
      ).status,
      200,
    );
    const both = (await (await commissioner.call(report)).json()) as Report;
    assert.equal(both.schools.length, 2);
    assert.equal(both.totals.present, 2);
    assert.equal(both.totals.total, 8);
    assert.equal(both.totals.missing, 1);
    assert.equal(attendanceRate(both.totals), '25.0%');
    assert.equal(attendanceRate(both.schools[1].totals), '0.0%');
    assert(both.schools.every((school) => school.classes === undefined));
    const drilldown = await (
      await commissioner.call(`${report}&school=school-a`)
    ).text();
    assert.match(drilldown, /not submitted/);
    assert.doesNotMatch(drilldown, /Sample learner|student-/);
    const officerCsv = await (
      await officer.call(`${report}&format=csv`)
    ).text();
    assert.match(officerCsv, /Demo School A/);
    assert.doesNotMatch(officerCsv, /Demo School B|Sample learner/);
    const municipalCsv = await (
      await commissioner.call(`${report}&school=school-b&format=csv`)
    ).text();
    assert.match(municipalCsv, /Demo School B/);
    assert.doesNotMatch(municipalCsv, /Sample learner|student-/);

    assert.equal(
      (
        await principalA.call(register('class-a'), {
          action: 'return',
          version: 1,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await principalA.call(register('class-a'), {
          action: 'return',
          version: 1,
          note: 'Check the last mark.',
        })
      ).status,
      200,
    );
    const returned = (await (await commissioner.call(report)).json()) as Report;
    assert.equal(returned.totals.returned, 1);
    assert.equal(returned.totals.total, 5);
    const corrected = { ...aMarks, [a.roster[2].id]: 'present' };
    assert.equal(
      (
        await teacherA.call(register('class-a'), {
          action: 'submit',
          version: 2,
          marks: corrected,
          note: 'Corrected roll 3.',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await principalA.call(register('class-a'), {
          action: 'review',
          version: 2,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await principalA.call(register('class-a'), {
          action: 'review',
          version: 3,
        })
      ).status,
      200,
    );

    // Revocation takes effect even while the prior session is still active.
    assert.equal(
      (
        await administrator.call('setup', {
          action: 'unassign',
          accountId: 'teacher.a',
          targetId: 'class-a',
        })
      ).status,
      200,
    );
    assert.equal((await teacherA.call(register('class-a'))).status, 404);
    assert.equal(
      (
        await administrator.call('setup', {
          action: 'assign',
          accountId: 'teacher.a',
          targetId: 'class-a',
        })
      ).status,
      200,
    );

    await service.close();
    service = await start(path);
    const persisted = (await (
      await client(service.origin, principalA.cookie()).call(
        register('class-a'),
      )
    ).json()) as RegisterView;
    assert.equal(persisted.register?.status, 'reviewed');
    assert.deepEqual(
      persisted.history.map(({ action, actor }) => [action, actor]),
      [
        ['submitted', 'Demo Teacher A'],
        ['returned', 'Demo Principal A'],
        ['resubmitted', 'Demo Teacher A'],
        ['reviewed', 'Demo Principal A'],
      ],
    );
    assert.equal(persisted.history[2].changedMarks, 1);
    assert.equal(persisted.history[2].note, 'Corrected roll 3.');
    assert(
      persisted.history.every((event) => Number.isFinite(Date.parse(event.at))),
    );
    assert.equal(persisted.register?.entries[2].mark, 'present');
    const final = (await (
      await client(service.origin, commissioner.cookie()).call(report)
    ).json()) as Report;
    assert.equal(attendanceRate(final.totals), '37.5%');
    const signedOut = client(service.origin, principalA.cookie());
    assert.equal((await signedOut.call('logout', {})).status, 200);
    assert.equal((await signedOut.call(register('class-a'))).status, 401);
  } finally {
    await service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('administrator provisions schools, enrolment and staff without code changes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'shiksha-erp-setup-'));
  const path = join(directory, 'pilot.sqlite');
  const seed = openFileDatabase(path);
  await initializeDatabase(seed);
  await seedFictionalSchools(seed, () => password);
  seed.close();
  const service = await start(path);
  try {
    const admin = client(service.origin);
    await admin.login('admin');
    const configure = async (payload: Record<string, unknown>) => {
      const response = await admin.call('setup', payload);
      assert.equal(response.status, 200);
      return (await response.json()) as Setup;
    };
    const first = await configure({
      action: 'school',
      name: 'Fictional configuration school',
      code: 'DEMO-C',
    });
    const schoolId = first.schools.find(
      (school) => school.code === 'DEMO-C',
    )?.id;
    assert(schoolId);
    assert.equal(
      (
        await admin.call('setup', {
          action: 'school',
          code: 'demo-c',
          name: 'Duplicate',
        })
      ).status,
      409,
    );
    const second = await configure({
      action: 'class',
      schoolId,
      grade: 'Class 4',
      section: 'A',
    });
    const classId = second.classes.find((row) => row.schoolId === schoolId)?.id;
    assert(classId);
    const third = await configure({
      action: 'student',
      classId,
      name: 'Sample learner C-1',
      roll: '1',
    });
    assert(third.enrolments.some((row) => row.classId === classId));
    const fourth = await configure({
      action: 'staff',
      name: 'Fictional staff C',
      role: 'teacher',
      username: 'teacher.c',
      password,
    });
    const accountId = fourth.staff.find(
      (row) => row.username === 'teacher.c',
    )?.id;
    assert(accountId);
    await configure({ action: 'assign', accountId, targetId: classId });
    const teacher = client(service.origin);
    await teacher.login('teacher.c');
    const workspace = (await (
      await teacher.call('session')
    ).json()) as Workspace;
    assert.deepEqual(
      workspace.schools.map((row) => row.id),
      [schoolId],
    );
    assert.equal(
      (
        await teacher.call('setup', {
          action: 'school',
          code: 'UNAUTHORIZED',
          name: 'Denied',
        })
      ).status,
      403,
    );
    const roster = (await (
      await teacher.call(register(classId))
    ).json()) as RegisterView;
    assert.equal(roster.roster[0].name, 'Sample learner C-1');
  } finally {
    await service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
