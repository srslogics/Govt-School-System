import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeDatabase,
  openFileDatabase,
  many,
  one,
} from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { seedTeacherDemo } from '../lib/erp/teacher-demo';
import { createHandler } from '../lib/erp/http';
import { todayInNagpur } from '../lib/erp/model';
import type { TeacherView } from '../lib/erp/teacher';
import type { LearningView } from '../lib/erp/learning';
void test('teacher profiles and timetable are scoped; bulk draft marks are atomic, editable and publication-locked', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'teacher-test-')),
    db = openFileDatabase(join(directory, 'test.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'TeacherTest-12345');
    await seedTeacherDemo(db);
    await seedTeacherDemo(db);
    assert.equal((await many(db, 'SELECT id FROM teaching_period')).length, 30);
    const origin = 'http://localhost',
      handler = createHandler(db, origin),
      day = todayInNagpur();
    function client() {
      let cookie = '';
      return {
        async call(path: string, body?: Record<string, unknown>) {
          const response = await handler(
            new Request(`${origin}/api/erp/${path}`, {
              method: body ? 'POST' : 'GET',
              headers: {
                cookie,
                ...(body ? { origin, 'Content-Type': 'application/json' } : {}),
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            }),
          );
          if (response.headers.has('set-cookie'))
            cookie = response.headers.get('set-cookie')!.split(';')[0];
          return response;
        },
      };
    }
    const [teacher, otherTeacher, principal, otherPrincipal, parent, admin] =
      Array.from({ length: 6 }, client);
    for (const [who, username] of [
      [teacher, 'teacher.a'],
      [otherTeacher, 'teacher.b'],
      [principal, 'principal.a'],
      [otherPrincipal, 'principal.b'],
      [parent, 'parent.a'],
      [admin, 'admin'],
    ] as const)
      assert.equal(
        (await who.call('login', { username, password: 'TeacherTest-12345' }))
          .status,
        200,
      );
    const read = async (who: ReturnType<typeof client>) => {
      const response = await who.call(`teacher?date=${day}`);
      assert.equal(response.status, 200);
      return (await response.json()) as TeacherView;
    };
    const own = await read(teacher);
    assert.equal(own.learners.length, 3);
    assert.equal(own.lessons.length, 15);
    assert(own.lessons.every((row) => row.teacherId === 'teacher.a'));
    assert(own.registers.every((row) => row.classId === 'class-a'));
    assert.equal((await parent.call(`teacher?date=${day}`)).status, 403);
    const period = {
      classId: 'class-a',
      teacherId: 'teacher.a',
      weekday: 6,
      start: '09:00',
      end: '09:40',
      subject: 'Art',
      room: 'Room 1',
    };
    assert.equal((await teacher.call('teacher', period)).status, 403);
    assert.equal((await otherPrincipal.call('teacher', period)).status, 404);
    assert.equal(
      (await principal.call('teacher', { ...period, teacherId: 'teacher.b' }))
        .status,
      404,
    );
    assert.equal(
      (await principal.call('teacher', { ...period, end: '08:59' })).status,
      400,
    );
    assert.equal((await principal.call('teacher', period)).status, 200);
    assert.equal(
      (
        await principal.call('teacher', {
          ...period,
          start: '09:10',
          end: '10:00',
        })
      ).status,
      409,
    );
    assert.equal((await read(teacher)).lessons.length, 16);
    assert.equal((await read(otherTeacher)).lessons.length, 15);
    const entry = (id: string, score: number, version = 0) => ({
      studentId: id,
      score,
      version,
      feedback: 'Good reasoning; practise word problems.',
    });
    const bulk = {
      action: 'bulk-marks',
      classId: 'class-a',
      subject: 'Maths',
      exam: 'Unit test 2',
      day,
      maximum: 100,
      entries: [entry('class-a-student-1', 80), entry('class-a-student-2', 70)],
    };
    assert.equal((await parent.call('learning', bulk)).status, 403);
    assert.equal((await otherTeacher.call('learning', bulk)).status, 404);
    assert.equal(
      (
        await teacher.call('learning', {
          ...bulk,
          entries: [
            entry('class-a-student-1', 80),
            entry('class-b-student-1', 90),
          ],
        })
      ).status,
      404,
    );
    assert.equal((await many(db, 'SELECT id FROM assessment')).length, 0);
    assert.equal(
      (
        await teacher.call('learning', {
          ...bulk,
          entries: [
            entry('class-a-student-1', 80),
            entry('class-a-student-2', 101),
          ],
        })
      ).status,
      400,
    );
    assert.equal((await many(db, 'SELECT id FROM assessment')).length, 0);
    assert.equal((await teacher.call('learning', bulk)).status, 200);
    let marks = (await read(teacher)).assessments;
    assert.equal(marks.length, 2);
    const family = (await (
      await parent.call(`learning?date=${day}`)
    ).json()) as LearningView;
    assert.equal(family.assessments.length, 0);
    assert.equal((await teacher.call('learning', bulk)).status, 409);
    assert.equal(
      (
        await teacher.call('learning', {
          ...bulk,
          entries: [
            entry('class-a-student-1', 82, 1),
            entry('class-a-student-2', 72, 1),
          ],
        })
      ).status,
      200,
    );
    marks = (await read(teacher)).assessments;
    const first = marks.find((row) => row.studentId === 'class-a-student-1')!;
    assert.equal(first.score, 82);
    const correction = {
      action: 'edit-assessment',
      id: first.id,
      version: 2,
      score: 85,
      maximum: 100,
      feedback: 'Corrected after checking the answer sheet.',
    };
    assert.equal((await otherTeacher.call('learning', correction)).status, 404);
    assert.equal((await teacher.call('learning', correction)).status, 200);
    assert.equal((await teacher.call('learning', correction)).status, 409);
    assert.equal(
      (
        await principal.call('learning', {
          action: 'publish',
          id: first.id,
          version: 3,
        })
      ).status,
      200,
    );
    assert.equal(
      (await teacher.call('learning', { ...correction, version: 4 })).status,
      409,
    );
    assert.equal(
      (
        await teacher.call('learning', {
          ...bulk,
          entries: [
            entry('class-a-student-2', 99, 2),
            entry('class-a-student-1', 99, 4),
          ],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await one<{ score: number }>(
          db,
          "SELECT score FROM assessment WHERE student_id='class-a-student-2'",
        )
      )?.score,
      72,
    );
    assert(
      await one(
        db,
        "SELECT id FROM school_activity WHERE action='draft marks edited' AND note LIKE '%previous%'",
      ),
    );
    assert.equal(
      (
        await admin.call('setup', {
          action: 'unassign',
          accountId: 'teacher.a',
          targetId: 'class-a',
        })
      ).status,
      200,
    );
    const revoked = await read(teacher);
    assert.equal(revoked.learners.length, 0);
    assert.equal(revoked.lessons.length, 0);
    assert.equal((await teacher.call('learning', bulk)).status, 404);
    await initializeDatabase(db);
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
