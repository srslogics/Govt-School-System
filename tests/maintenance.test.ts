import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeDatabase,
  openFileDatabase,
  run,
  one,
} from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { createHandler } from '../lib/erp/http';
import { todayInNagpur } from '../lib/erp/model';
import type { MaintenanceView } from '../lib/erp/maintenance';
import type { OversightView } from '../lib/erp/oversight';

void test('maintenance assignment, blocked work, verified closure and education-office escalation enforce scope and preserve history', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'maintenance-')),
    file = join(directory, 'test.sqlite'),
    db = openFileDatabase(file);
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Maintenance-Test-1234');
    await run(
      db,
      "INSERT INTO account SELECT 'support.second','support.second','Second Fictional Support','support',password_hash FROM account WHERE id='support.a'",
    );
    await run(
      db,
      "INSERT INTO school_assignment VALUES ('support.second','school-a')",
    );
    const origin = 'http://localhost',
      handler = createHandler(db, origin),
      day = todayInNagpur();
    const client = async (username: string) => {
      let cookie = '';
      const call = async (path: string, body?: Record<string, unknown>) => {
        const r = await handler(
          new Request(origin + '/api/erp/' + path, {
            method: body ? 'POST' : 'GET',
            headers: {
              cookie,
              ...(body ? { origin, 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        );
        if (r.headers.has('set-cookie'))
          cookie = r.headers.get('set-cookie')!.split(';')[0];
        return r;
      };
      assert.equal(
        (await call('login', { username, password: 'Maintenance-Test-1234' }))
          .status,
        200,
      );
      return {
        call,
        view: async () =>
          (await (await call('maintenance')).json()) as MaintenanceView,
      };
    };
    const principal = await client('principal.a'),
      other = await client('principal.b'),
      support = await client('support.a'),
      second = await client('support.second'),
      teacher = await client('teacher.a'),
      library = await client('library.a'),
      parent = await client('parent.a'),
      officer = await client('officer.a');
    const save = async (
      who: typeof teacher,
      body: Record<string, unknown>,
      expected = 200,
    ) => {
      const response = await who.call('maintenance', {
        schoolId: 'school-a',
        ...body,
      });
      const value = (await response.json()) as {
        id: string;
        requestId: string | null;
      };
      assert.equal(response.status, expected, JSON.stringify(value));
      return value;
    };
    const create = {
      action: 'create',
      title: 'Washroom tap repair',
      category: 'water',
      location: 'Ground-floor washroom',
      priority: 'high',
      note: 'Tap leaking after school hours',
    };
    assert.equal((await parent.call('maintenance')).status, 403);
    assert.equal((await officer.call('maintenance')).status, 403);
    await save(other, create, 404);
    const { id } = await save(teacher, create);
    assert.equal((await support.view()).tickets.length, 0);
    assert.equal((await library.view()).tickets.length, 0);
    assert.equal((await teacher.view()).tickets.length, 1);
    const assign = {
      action: 'assign',
      id,
      version: 1,
      assigneeId: 'support.a',
      due: day,
      priority: 'urgent',
      note: 'Repair and check water supply',
    };
    await save(teacher, assign, 403);
    await save(principal, { ...assign, assigneeId: 'teacher.a' }, 400);
    await save(principal, assign);
    assert.equal((await support.view()).tickets.length, 1);
    assert.equal((await second.view()).tickets.length, 0);
    await save(
      second,
      {
        action: 'progress',
        id,
        version: 2,
        status: 'reported',
        note: 'Wrong support member',
      },
      404,
    );
    await save(
      support,
      {
        action: 'verify',
        id,
        version: 2,
        status: 'closed',
        note: 'Self verification',
      },
      403,
    );
    await save(
      principal,
      {
        action: 'progress',
        id,
        version: 2,
        status: 'reported',
        note: 'Principal cannot impersonate staff',
      },
      403,
    );
    await save(support, {
      action: 'progress',
      id,
      version: 2,
      status: 'blocked',
      note: 'Replacement valve needed',
    });
    const escalated = await save(principal, {
      action: 'escalate',
      id,
      version: 3,
      note: 'External repair assistance needed',
    });
    assert(escalated.requestId);
    await save(
      principal,
      { action: 'escalate', id, version: 4, note: 'Duplicate escalation' },
      409,
    );
    const office = (await (
      await officer.call('oversight?date=' + day)
    ).json()) as OversightView;
    assert.equal(
      office.records.filter((row) => row.id === escalated.requestId).length,
      1,
    );
    assert.equal(
      office.records.find((row) => row.id === escalated.requestId)?.data
        .category,
      'maintenance',
    );
    assert.equal(
      (
        await officer.call('oversight', {
          schoolId: 'school-a',
          action: 'review-request',
          id: escalated.requestId,
          version: 1,
          note: 'Repair requirement reviewed',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await officer.call('oversight', {
          schoolId: 'school-a',
          action: 'request-decision',
          id: escalated.requestId,
          version: 2,
          status: 'resolved',
          note: 'Technical assistance coordinated',
        })
      ).status,
      200,
    );
    assert.equal((await support.view()).tickets[0].officeStatus, 'resolved');
    assert.equal((await support.view()).tickets[0].status, 'blocked');
    await save(support, {
      action: 'progress',
      id,
      version: 4,
      status: 'reported',
      note: 'Valve replaced and supply restored',
    });
    await save(principal, {
      action: 'verify',
      id,
      version: 5,
      status: 'in-progress',
      note: 'Check adjacent washroom also',
    });
    await save(support, {
      action: 'progress',
      id,
      version: 6,
      status: 'reported',
      note: 'Adjacent washroom checked',
    });
    await save(principal, {
      action: 'verify',
      id,
      version: 7,
      status: 'closed',
      note: 'Verified both washrooms',
    });
    await save(
      principal,
      {
        action: 'verify',
        id,
        version: 7,
        status: 'closed',
        note: 'Stale duplicate',
      },
      409,
    );
    await save(
      support,
      {
        action: 'progress',
        id,
        version: 8,
        status: 'reported',
        note: 'Already closed',
      },
      409,
    );
    await save(principal, {
      action: 'reopen',
      id,
      version: 8,
      note: 'Leak recurred after a week',
    });
    let ticket = (await principal.view()).tickets.find((row) => row.id === id)!;
    assert.equal(ticket.status, 'open');
    assert.equal(ticket.assigneeId, null);
    assert.equal(ticket.progress, '');
    await save(principal, {
      ...assign,
      version: 9,
      assigneeId: 'support.second',
      priority: 'high',
      note: 'Assign follow-up to second support member',
    });
    assert.equal((await support.view()).tickets.length, 0);
    assert.equal((await support.view()).history.length, 0);
    assert.equal((await second.view()).tickets.length, 1);
    await save(
      support,
      {
        action: 'progress',
        id,
        version: 10,
        status: 'reported',
        note: 'Former owner',
      },
      404,
    );
    await save(principal, {
      action: 'cancel',
      id,
      version: 10,
      note: 'Duplicate of planned facilities work',
    });
    ticket = (await second.view()).tickets[0];
    assert.equal(ticket.status, 'cancelled');
    await save(
      second,
      {
        action: 'progress',
        id,
        version: 11,
        status: 'reported',
        note: 'Cancelled job',
      },
      409,
    );
    const owned = (await save(support, create)).id;
    assert((await support.view()).tickets.some((row) => row.id === owned));
    assert(!(await second.view()).tickets.some((row) => row.id === owned));
    await run(
      db,
      "DELETE FROM school_assignment WHERE account_id='support.second'",
    );
    assert.equal((await second.view()).tickets.length, 0);
    await save(second, create, 404);
    await run(db, "DELETE FROM class_assignment WHERE account_id='teacher.a'");
    assert.equal((await teacher.view()).tickets.length, 0);
    await save(teacher, create, 404);
    const reopened = openFileDatabase(file);
    try {
      assert.equal(
        (
          await one<{ status: string }>(
            reopened,
            'SELECT status FROM maintenance_ticket WHERE id=?',
            id,
          )
        )?.status,
        'cancelled',
      );
    } finally {
      reopened.close();
    }
    assert(
      (await principal.view()).history.some(
        (row) =>
          (JSON.parse(row.note) as { note: string }).note ===
          'Replacement valve needed',
      ),
    );
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
