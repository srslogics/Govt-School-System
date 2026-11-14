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
} from '../lib/erp/database';
import { seedFictionalSchools } from '../lib/erp/seed';
import { seedLearningDemo } from '../lib/erp/learning-demo';
import { createHandler } from '../lib/erp/http';
import { todayInNagpur } from '../lib/erp/model';
import type { OversightView } from '../lib/erp/oversight';

void test('education oversight connects principal/officer/Commissioner workflows and protects school and personal data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oversight-')),
    db = openFileDatabase(join(dir, 'test.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Oversight-Test-1234');
    await seedLearningDemo(db);
    const origin = 'http://localhost',
      handler = createHandler(db, origin),
      day = todayInNagpur();
    const client = async (username: string) => {
      let cookie = '';
      const call = async (path: string, body?: Record<string, unknown>) => {
        const response = await handler(
          new Request(origin + '/api/erp/' + path, {
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
      };
      assert.equal(
        (await call('login', { username, password: 'Oversight-Test-1234' }))
          .status,
        200,
      );
      return {
        call,
        view: async () =>
          (await (await call('oversight?date=' + day)).json()) as OversightView,
      };
    };
    const officer = await client('officer.a'),
      principal = await client('principal.a'),
      other = await client('principal.b'),
      commissioner = await client('commissioner'),
      parent = await client('parent.a'),
      teacher = await client('teacher.a');
    const save = async (
      who: typeof officer,
      body: Record<string, unknown>,
      status = 200,
    ) => {
      const r = await who.call('oversight', { schoolId: 'school-a', ...body });
      const result = (await r.json()) as { id: string };
      assert.equal(r.status, status, JSON.stringify(result));
      return result.id;
    };
    assert.equal((await parent.call('oversight?date=' + day)).status, 403);
    assert.equal((await teacher.call('oversight?date=' + day)).status, 403);
    let view = await officer.view();
    assert.deepEqual(
      view.schools.map((s) => s.id),
      ['school-a'],
    );
    assert.equal(view.schools[0].enrolled, 5);
    assert.equal(view.schools[0].staff, 6);
    assert.equal(view.schools[0].attendance.expected, 2);
    assert.equal(view.schools[0].attendance.missing, 2);
    assert(!JSON.stringify(view).includes('Sample learner'));
    assert(!JSON.stringify(view).includes('password_hash'));
    const visit = await save(officer, {
      action: 'inspection',
      title: 'School quality visit',
      visitDate: day,
      note: 'Review classrooms and records',
    });
    await save(
      principal,
      {
        action: 'inspection',
        title: 'Not officer',
        visitDate: day,
        note: 'Forbidden',
      },
      403,
    );
    await save(
      officer,
      {
        action: 'inspection',
        schoolId: 'school-b',
        title: 'Other school',
        visitDate: day,
        note: 'Forbidden',
      },
      404,
    );
    await save(
      officer,
      {
        action: 'findings',
        id: visit,
        version: 1,
        visitedOn: '2099-01-01',
        due: '2099-01-02',
        requiredAction: 'Repair desks',
        note: 'Future visit',
      },
      400,
    );
    await save(officer, {
      action: 'findings',
      id: visit,
      version: 1,
      visitedOn: day,
      due: day,
      requiredAction: 'Repair desks',
      note: 'Two desks damaged',
    });
    await save(
      other,
      {
        action: 'inspection-response',
        id: visit,
        version: 2,
        note: 'Cross-school action',
      },
      404,
    );
    await save(principal, {
      action: 'inspection-response',
      id: visit,
      version: 2,
      note: 'Desks repaired; office checked',
    });
    await save(officer, {
      action: 'inspection-decision',
      id: visit,
      version: 3,
      status: 'visited',
      note: 'Confirm final classroom check',
    });
    await save(principal, {
      action: 'inspection-response',
      id: visit,
      version: 4,
      note: 'Final classroom check complete',
    });
    await save(officer, {
      action: 'inspection-decision',
      id: visit,
      version: 5,
      status: 'closed',
      note: 'Verified during follow-up',
    });
    await save(
      officer,
      {
        action: 'inspection-decision',
        id: visit,
        version: 5,
        status: 'closed',
        note: 'Stale duplicate',
      },
      409,
    );
    const request = await save(principal, {
      action: 'request',
      title: 'Desk repair assistance',
      category: 'maintenance',
      priority: 'high',
      note: 'Request technical support',
    });
    await save(
      officer,
      {
        action: 'request',
        title: 'Not principal',
        category: 'maintenance',
        priority: 'high',
        note: 'Forbidden',
      },
      403,
    );
    await save(officer, {
      action: 'review-request',
      id: request,
      version: 1,
      note: 'Reviewed requirement',
    });
    await save(officer, {
      action: 'request-decision',
      id: request,
      version: 2,
      status: 'returned',
      note: 'Provide room count',
    });
    await save(principal, {
      action: 'resubmit-request',
      id: request,
      version: 3,
      note: 'Three classrooms affected',
    });
    await save(officer, {
      action: 'review-request',
      id: request,
      version: 4,
      note: 'Details now complete',
    });
    await save(officer, {
      action: 'request-decision',
      id: request,
      version: 5,
      status: 'escalated',
      note: 'Commissioner review required',
    });
    await save(
      officer,
      {
        action: 'request-decision',
        id: request,
        version: 6,
        status: 'resolved',
        note: 'Cannot resolve escalated',
      },
      409,
    );
    assert(
      (await commissioner.view()).records.some(
        (r) => r.id === request && r.status === 'escalated',
      ),
    );
    await save(commissioner, {
      action: 'request-decision',
      id: request,
      version: 6,
      status: 'resolved',
      note: 'Coordinated technical inspection; no financial sanction',
    });
    const circular = await save(officer, {
      action: 'circular',
      title: 'School safety check',
      due: day,
      note: 'Report classroom safety checks',
      schoolIds: ['school-a'],
    });
    await save(
      principal,
      {
        action: 'compliance',
        id: circular,
        version: 1,
        note: 'Must acknowledge first',
      },
      409,
    );
    await save(principal, {
      action: 'acknowledge',
      id: circular,
      version: 1,
      note: 'Received by school office',
    });
    await save(principal, {
      action: 'compliance',
      id: circular,
      version: 2,
      note: 'Classroom safety review complete',
    });
    await save(officer, {
      action: 'verify-compliance',
      id: circular,
      version: 3,
      status: 'acknowledged',
      note: 'Add playground findings',
    });
    await save(principal, {
      action: 'compliance',
      id: circular,
      version: 4,
      note: 'Playground check also complete',
    });
    await save(officer, {
      action: 'verify-compliance',
      id: circular,
      version: 5,
      status: 'closed',
      note: 'Full report verified',
    });
    const before = (await officer.view()).records.length;
    await save(
      officer,
      {
        action: 'circular',
        title: 'Invalid broadcast',
        due: day,
        note: 'Cannot include other school',
        schoolIds: ['school-a', 'school-b'],
      },
      404,
    );
    assert.equal((await officer.view()).records.length, before);
    await save(commissioner, {
      action: 'circular',
      title: 'Municipal instruction',
      due: day,
      note: 'Each school must respond separately',
      schoolIds: ['school-a', 'school-b'],
    });
    assert.equal(
      (await commissioner.view()).records.filter(
        (r) => r.data.title === 'Municipal instruction',
      ).length,
      2,
    );
    assert.equal((await other.view()).records.length, 1);
    assert(
      (await officer.view()).history.every(
        (h) => (JSON.parse(h.note) as { note: string }).note,
      ),
    );
    // Summaries match the authoritative attendance report without exposing names or rows.
    const register = await principal.call('register/class-a/' + day);
    const roster = (
      (await register.json()) as {
        roster: { id: string; name: string; roll: string }[];
      }
    ).roster;
    assert.equal(
      (
        await teacher.call('register/class-a/' + day, {
          action: 'submit',
          version: 0,
          marks: Object.fromEntries(
            roster.map((r, index) => [
              r.id,
              index === 0 ? 'present' : 'absent',
            ]),
          ),
        })
      ).status,
      200,
    );
    view = await officer.view();
    assert.equal(view.schools[0].attendance.present, 1);
    assert.equal(view.schools[0].attendance.total, 3);
    assert.equal(view.schools[0].attendance.missing, 1);
    const accounts = await client('accounts.a'),
      support = await client('support.a');
    await accounts.call('operations', {
      action: 'payroll',
      schoolId: 'school-a',
      staffId: 'teacher.a',
      month: day.slice(0, 7),
      gross: 5000000,
      deductions: 10000,
      note: 'Private payroll note',
    });
    await accounts.call('operations', {
      action: 'grant',
      schoolId: 'school-a',
      title: 'Books',
      reference: 'TEST-GRANT',
      amount: 100000,
      day,
      note: 'Grant test',
    });
    await support.call('operations', {
      action: 'inventory',
      schoolId: 'school-a',
      title: 'Desks',
      code: 'TEST-DESK',
      unit: 'pieces',
      quantity: 0,
      note: 'Awaiting stock',
    });
    view = await officer.view();
    assert.equal(view.schools[0].grants, 100000);
    assert.equal(view.schools[0].zeroStock, 1);
    assert(!JSON.stringify(view).includes('Private payroll note'));
    assert(!JSON.stringify(view).includes('5000000'));
    await run(db, "DELETE FROM school_assignment WHERE account_id='officer.a'");
    assert.equal((await officer.view()).records.length, 0);
    await save(
      officer,
      {
        action: 'inspection',
        title: 'Access revoked',
        visitDate: day,
        note: 'Cannot create',
      },
      404,
    );
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
    assert.equal(
      (
        await one<{ status: string }>(
          db,
          'SELECT status FROM education_record WHERE id=?',
          request,
        )
      )?.status,
      'resolved',
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
