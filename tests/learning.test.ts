import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeDatabase,
  openFileDatabase,
  one,
  run,
  many,
} from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { seedLearningDemo } from '../lib/erp/learning-demo';
import { createHandler } from '../lib/erp/http';
import { todayInNagpur, type RegisterView } from '../lib/erp/model';
import type { LearningView } from '../lib/erp/learning';

void test('learning API enforces child/class scope, principal publication, homework ownership, stale writes and revocation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'learning-test-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'FictionalLearning-1234');
    const origin = 'http://127.0.0.1:3012',
      day = todayInNagpur(),
      handler = createHandler(db, origin);
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
    const [
      parent,
      otherParent,
      teacher,
      otherTeacher,
      principal,
      otherPrincipal,
      clerk,
      admin,
    ] = Array.from({ length: 8 }, client);
    for (const [who, username] of [
      [parent, 'parent.a'],
      [otherParent, 'parent.b'],
      [teacher, 'teacher.a'],
      [otherTeacher, 'teacher.b'],
      [principal, 'principal.a'],
      [otherPrincipal, 'principal.b'],
      [clerk, 'office.a'],
      [admin, 'admin'],
    ] as const)
      assert.equal(
        (
          await who.call('login', {
            username,
            password: 'FictionalLearning-1234',
          })
        ).status,
        200,
      );
    const read = async (who: ReturnType<typeof client>) => {
      const response = await who.call(`learning?date=${day}`);
      assert.equal(response.status, 200);
      return (await response.json()) as LearningView;
    };
    assert.equal((await clerk.call(`learning?date=${day}`)).status, 403);
    assert.deepEqual(
      (await read(parent)).learners.map((row) => row.id),
      ['class-a-student-1'],
    );
    const assessment = {
      action: 'assessment',
      studentId: 'class-a-student-1',
      subject: 'Mathematics',
      exam: 'Unit Test 1',
      day,
      score: 75,
      maximum: 100,
      feedback: 'Good number skills. Practise word problems.',
    };
    assert.equal((await parent.call('learning', assessment)).status, 403);
    assert.equal((await otherTeacher.call('learning', assessment)).status, 404);
    assert.equal(
      (await teacher.call('learning', { ...assessment, score: 101 })).status,
      400,
    );
    assert.equal(
      (await teacher.call('learning', { ...assessment, maximum: 0 })).status,
      400,
    );
    assert.equal((await teacher.call('learning', assessment)).status, 200);
    assert.equal((await read(parent)).assessments.length, 0);
    const result = (await read(teacher)).assessments[0];
    const publish = { action: 'publish', id: result.id, version: 1 };
    assert.equal((await teacher.call('learning', publish)).status, 403);
    assert.equal((await otherPrincipal.call('learning', publish)).status, 404);
    assert.equal((await principal.call('learning', publish)).status, 200);
    assert.equal((await principal.call('learning', publish)).status, 409);
    assert.equal((await read(parent)).assessments[0].score, 75);
    assert.equal((await read(otherParent)).assessments.length, 0);
    const homework = {
      action: 'homework',
      classId: 'class-a',
      subject: 'Maths',
      title: 'Practise fractions',
      body: 'Solve five fractions.',
      due: day,
    };
    assert.equal((await parent.call('learning', homework)).status, 403);
    assert.equal((await otherTeacher.call('learning', homework)).status, 404);
    assert.equal(
      (await teacher.call('learning', { ...homework, due: '2026-02-31' }))
        .status,
      400,
    );
    assert.equal((await teacher.call('learning', homework)).status, 200);
    const task = (await read(parent)).homework[0];
    assert.equal((await read(otherParent)).homework.length, 0);
    const submission = {
      action: 'submit',
      id: task.id,
      studentId: 'class-a-student-1',
      version: 0,
      note: 'Solved all five fractions.',
    };
    assert.equal((await otherParent.call('learning', submission)).status, 404);
    assert.equal(
      (
        await parent.call('learning', {
          ...submission,
          studentId: 'class-a-student-2',
        })
      ).status,
      404,
    );
    assert.equal((await parent.call('learning', submission)).status, 200);
    assert.equal((await parent.call('learning', submission)).status, 409);
    const feedback = {
      action: 'feedback',
      id: task.id,
      studentId: 'class-a-student-1',
      version: 1,
      feedback: 'Well done. Recheck the final example.',
    };
    assert.equal((await parent.call('learning', feedback)).status, 403);
    assert.equal((await otherTeacher.call('learning', feedback)).status, 404);
    assert.equal((await teacher.call('learning', feedback)).status, 200);
    assert.equal(
      (await read(parent)).submissions[0].feedback,
      feedback.feedback,
    );
    assert.equal((await read(otherParent)).submissions.length, 0);
    const register = (await (
      await teacher.call(`register/class-a/${day}`)
    ).json()) as RegisterView;
    assert.equal(
      (
        await teacher.call(`register/class-a/${day}`, {
          action: 'submit',
          version: 0,
          marks: Object.fromEntries(
            register.roster.map((student, index) => [
              student.id,
              index ? 'absent' : 'present',
            ]),
          ),
        })
      ).status,
      200,
    );
    const attendance = (await read(parent)).attendance;
    assert.equal(attendance.length, 1);
    assert.equal(attendance[0].mark, 'present');
    assert.equal(
      (
        await principal.call(`register/class-a/${day}`, {
          action: 'return',
          version: 1,
          note: 'Check attendance.',
        })
      ).status,
      200,
    );
    assert.equal((await read(parent)).attendance[0].mark, null);
    assert.equal(
      (
        await admin.call('setup', {
          action: 'unguardian',
          accountId: 'parent.a',
          studentId: 'class-a-student-1',
        })
      ).status,
      200,
    );
    const revoked = await read(parent);
    assert.equal(revoked.learners.length, 0);
    assert.equal(revoked.assessments.length, 0);
    assert.equal(revoked.homework.length, 0);
    assert.equal(
      (await parent.call('learning', { ...submission, version: 2 })).status,
      404,
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
    assert.equal((await teacher.call('learning', assessment)).status, 404);
    assert(
      await one(
        db,
        "SELECT id FROM school_activity WHERE action='assessment published'",
      ),
    );
    await initializeDatabase(db);
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
void test('fictional learning examples seed once, preserve attendance and exclude customised school databases', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'learning-seed-'));
  const db = openFileDatabase(join(directory, 'test.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'FictionalLearning-1234');
    await seedLearningDemo(db);
    assert.equal((await many(db, 'SELECT id FROM assessment')).length, 6);
    assert.equal((await many(db, 'SELECT id FROM homework')).length, 2);
    assert.equal((await many(db, 'SELECT id FROM register')).length, 0);
    await seedLearningDemo(db);
    assert.equal((await many(db, 'SELECT id FROM assessment')).length, 6);
    await run(db, "DELETE FROM school_activity WHERE id='learning-demo-v1'");
    await run(db, "UPDATE school SET name='Custom school' WHERE id='school-a'");
    await seedLearningDemo(db);
    assert.equal((await many(db, 'SELECT id FROM assessment')).length, 6);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
