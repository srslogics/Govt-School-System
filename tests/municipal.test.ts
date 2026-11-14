import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeDatabase, openFileDatabase, run } from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { createHandler } from '../lib/erp/http';
import { todayInNagpur } from '../lib/erp/model';
import type { MunicipalView } from '../lib/erp/municipal';

void test('Commissioner priorities enforce current officer ownership, verification, reassignment, audit and scoped safe exports', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'municipal-')),
    db = openFileDatabase(join(dir, 'test.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Municipal-Test-1234');
    await run(
      db,
      "INSERT INTO account SELECT 'officer.second','officer.second','Second Fictional Officer','officer',password_hash FROM account WHERE id='officer.a'",
    );
    await run(
      db,
      "INSERT INTO school_assignment VALUES ('officer.second','school-a')",
    );
    const origin = 'http://localhost',
      handler = createHandler(db, origin),
      day = todayInNagpur();
    const client = async (username: string) => {
      let cookie = '';
      const call = async (path: string, body?: Record<string, unknown>) => {
        const result = await handler(
          new Request(origin + '/api/erp/' + path, {
            method: body ? 'POST' : 'GET',
            headers: {
              cookie,
              ...(body ? { origin, 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        );
        if (result.headers.has('set-cookie'))
          cookie = result.headers.get('set-cookie')!.split(';')[0];
        return result;
      };
      assert.equal(
        (await call('login', { username, password: 'Municipal-Test-1234' }))
          .status,
        200,
      );
      return {
        call,
        view: async () =>
          (await (await call('municipal')).json()) as MunicipalView,
      };
    };
    const commissioner = await client('commissioner'),
      officer = await client('officer.a'),
      second = await client('officer.second'),
      principal = await client('principal.a'),
      other = await client('principal.b'),
      parent = await client('parent.a');
    const save = async (
      who: typeof commissioner,
      body: Record<string, unknown>,
      expected = 200,
    ) => {
      const response = await who.call('municipal', {
        schoolId: 'school-a',
        ...body,
      });
      const result = (await response.json()) as { id: string };
      assert.equal(response.status, expected, JSON.stringify(result));
      return result.id;
    };
    const assignment = {
      action: 'assign',
      officerId: 'officer.a',
      title: 'Classroom repair coordination',
      category: 'infrastructure',
      priority: 'high',
      due: day,
      note: 'Coordinate school inspection and report completion',
    };
    assert.equal((await parent.call('municipal')).status, 403);
    await save(principal, assignment, 403);
    await save(officer, assignment, 403);
    await save(commissioner, { ...assignment, schoolId: 'school-b' }, 400);
    await save(commissioner, { ...assignment, officerId: 'principal.a' }, 400);
    const id = await save(commissioner, assignment);
    assert.equal((await officer.view()).priorities.length, 1);
    assert.equal((await second.view()).priorities.length, 0);
    assert.equal((await other.view()).priorities.length, 0);
    assert.equal((await principal.view()).priorities.length, 1);
    assert.equal((await principal.view()).officers.length, 0);
    await save(
      second,
      {
        action: 'progress',
        id,
        version: 1,
        status: 'reported',
        note: 'Wrong owner',
      },
      404,
    );
    await save(
      officer,
      {
        action: 'verify',
        id,
        version: 1,
        status: 'closed',
        note: 'Cannot verify own work',
      },
      403,
    );
    await save(
      commissioner,
      {
        action: 'progress',
        id,
        version: 1,
        status: 'reported',
        note: 'Officer must report',
      },
      403,
    );
    await save(officer, {
      action: 'progress',
      id,
      version: 1,
      status: 'in-progress',
      note: 'Visited school and arranged repairs',
    });
    await save(officer, {
      action: 'progress',
      id,
      version: 2,
      status: 'reported',
      note: 'Repairs completed and school confirmed',
    });
    await save(
      commissioner,
      {
        action: 'verify',
        id,
        version: 2,
        status: 'closed',
        note: 'Stale version',
      },
      409,
    );
    await save(commissioner, {
      action: 'verify',
      id,
      version: 3,
      status: 'in-progress',
      note: 'Confirm classroom safety after repair',
    });
    await save(officer, {
      action: 'progress',
      id,
      version: 4,
      status: 'reported',
      note: 'Safety check now complete',
    });
    await save(commissioner, {
      action: 'verify',
      id,
      version: 5,
      status: 'closed',
      note: 'Verified completion report',
    });
    await save(
      commissioner,
      {
        action: 'reassign',
        id,
        version: 6,
        officerId: 'officer.second',
        note: 'Closed already',
      },
      409,
    );
    const history = (await commissioner.view()).history.filter(
      (row) => row.targetId === id,
    );
    assert.equal(history.length, 6);
    assert(
      history.some(
        (row) =>
          (JSON.parse(row.note) as { note: string }).note ===
          'Confirm classroom safety after repair',
      ),
    );
    const next = await save(commissioner, {
      ...assignment,
      title: 'Additional school follow-up',
    });
    await save(commissioner, {
      action: 'reassign',
      id: next,
      version: 1,
      officerId: 'officer.second',
      note: 'Transferred to second officer',
    });
    assert(!(await officer.view()).priorities.some((row) => row.id === next));
    assert(
      !(await officer.view()).history.some((row) => row.targetId === next),
    );
    await save(
      officer,
      {
        action: 'progress',
        id: next,
        version: 2,
        status: 'reported',
        note: 'Former officer',
      },
      404,
    );
    await save(second, {
      action: 'progress',
      id: next,
      version: 2,
      status: 'reported',
      note: 'New owner completed action',
    });
    await run(
      db,
      "DELETE FROM school_assignment WHERE account_id='officer.second' AND school_id='school-a'",
    );
    assert.equal((await second.view()).priorities.length, 0);
    await save(
      second,
      {
        action: 'progress',
        id: next,
        version: 3,
        status: 'reported',
        note: 'Revoked school',
      },
      404,
    );
    const view = await commissioner.call('oversight?date=' + day);
    assert.equal(view.status, 200);
    assert.equal(
      ((await view.json()) as { municipal: MunicipalView }).municipal.priorities
        .length,
      2,
    );
    assert.equal(
      (await officer.call('oversight?date=' + day + '&format=csv')).status,
      403,
    );
    await run(
      db,
      "UPDATE school SET name='=Formula school' WHERE id='school-a'",
    );
    const exportResponse = await commissioner.call(
      'oversight?date=' + day + '&format=csv',
    );
    assert.equal(exportResponse.status, 200);
    assert(exportResponse.headers.get('content-type')?.includes('text/csv'));
    const csv = await exportResponse.text();
    assert.equal(csv.split('\r\n').length, 3);
    assert(csv.includes('"\'=Formula school"'));
    assert(!csv.includes('Sample learner'));
    assert(!csv.includes('password_hash'));
    assert(!csv.includes('Coordinate school inspection'));
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
