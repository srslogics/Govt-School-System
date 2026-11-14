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
import { createHandler } from '../lib/erp/http';
import { todayInNagpur } from '../lib/erp/model';
import type { OperationsView } from '../lib/erp/operations';

void test('school operations enforce role/school scope, atomic admission, approvals, exact payroll, grant and inventory balances', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'school-operations-')),
    db = openFileDatabase(join(directory, 'test.sqlite'));
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Operations-Test-1234');
    const origin = 'http://localhost',
      handler = createHandler(db, origin),
      day = todayInNagpur();
    const client = async (username: string) => {
      let cookie = '';
      const call = async (body?: Record<string, unknown>) => {
        const response = await handler(
          new Request(
            origin + '/api/erp/' + (body?.username ? 'login' : 'operations'),
            {
              method: body ? 'POST' : 'GET',
              headers: {
                cookie,
                ...(body ? { origin, 'Content-Type': 'application/json' } : {}),
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            },
          ),
        );
        if (response.headers.has('set-cookie'))
          cookie = response.headers.get('set-cookie')!.split(';')[0];
        return response;
      };
      assert.equal(
        (await call({ username, password: 'Operations-Test-1234' })).status,
        200,
      );
      return {
        call,
        view: async () => (await (await call()).json()) as OperationsView,
      };
    };
    const principal = await client('principal.a'),
      other = await client('principal.b'),
      teacher = await client('teacher.a'),
      office = await client('office.a'),
      accounts = await client('accounts.a'),
      support = await client('support.a'),
      parent = await client('parent.a'),
      admin = await client('admin');
    const create = async (
      who: typeof principal,
      body: Record<string, unknown>,
      expected = 200,
    ) => {
      const response = await who.call({ schoolId: 'school-a', ...body });
      const result = (await response.json()) as { id: string; error?: string };
      assert.equal(response.status, expected, JSON.stringify(result));
      return result.id;
    };
    assert.equal((await admin.call()).status, 403);
    await create(
      other,
      {
        action: 'calendar',
        title: 'Intrusion',
        start: day,
        end: day,
        audience: 'all',
        category: 'meeting',
        note: 'No access',
      },
      404,
    );
    await create(
      parent,
      { action: 'leave', start: day, end: day, reason: 'No access' },
      403,
    );
    await create(
      teacher,
      {
        action: 'staff-attendance',
        staffId: 'teacher.a',
        day,
        status: 'present',
        note: 'Cannot self-mark',
      },
      403,
    );
    const attendance = await create(principal, {
      action: 'staff-attendance',
      staffId: 'teacher.a',
      day,
      status: 'present',
      note: 'Morning register',
    });
    await create(
      principal,
      {
        action: 'staff-attendance',
        staffId: 'teacher.a',
        day,
        status: 'absent',
        note: 'Duplicate',
      },
      409,
    );
    await create(principal, {
      action: 'staff-attendance',
      id: attendance,
      version: 1,
      staffId: 'teacher.a',
      day,
      status: 'leave',
      note: 'Correction after confirmed leave',
    });
    await create(
      principal,
      {
        action: 'staff-attendance',
        id: attendance,
        version: 1,
        staffId: 'teacher.a',
        day,
        status: 'present',
        note: 'Stale correction',
      },
      409,
    );
    await create(
      principal,
      {
        action: 'staff-attendance',
        staffId: 'teacher.b',
        day,
        status: 'present',
        note: 'Other school',
      },
      404,
    );
    const leave = await create(teacher, {
      action: 'leave',
      start: day,
      end: day,
      reason: 'Personal appointment',
    });
    await create(
      teacher,
      { action: 'leave', start: day, end: day, reason: 'Overlapping leave' },
      409,
    );
    await create(
      teacher,
      {
        action: 'decide',
        id: leave,
        version: 1,
        status: 'approved',
        note: 'Self approval',
      },
      403,
    );
    await create(principal, {
      action: 'decide',
      id: leave,
      version: 1,
      status: 'approved',
      note: 'Cover arranged',
    });
    await create(
      principal,
      {
        action: 'decide',
        id: leave,
        version: 2,
        status: 'declined',
        note: 'Already decided',
      },
      409,
    );
    const ownLeave = await create(principal, {
      action: 'leave',
      start: day,
      end: day,
      reason: 'Principal appointment',
    });
    await create(
      principal,
      {
        action: 'decide',
        id: ownLeave,
        version: 1,
        status: 'approved',
        note: 'Cannot approve own',
      },
      403,
    );
    assert(
      (await teacher.view()).records.every(
        (row) =>
          ['leave', 'staff-attendance'].includes(row.kind) &&
          row.data.staffId === 'teacher.a',
      ),
    );
    assert(
      (await teacher.view()).history.every((row) =>
        [leave, attendance].includes(row.targetId),
      ),
    );
    const application = await create(office, {
      action: 'admission',
      classId: 'class-a',
      name: 'New learner',
      guardian: 'Guardian',
      contact: 'Fictional contact',
      day,
      note: 'Documents checked',
    });
    await create(
      office,
      {
        action: 'decide',
        id: application,
        version: 1,
        status: 'admitted',
        roll: '90',
        effectiveOn: day,
        note: 'No office approval',
      },
      403,
    );
    await create(
      principal,
      {
        action: 'decide',
        id: application,
        version: 1,
        status: 'admitted',
        roll: '1',
        effectiveOn: day,
        note: 'Duplicate roll',
      },
      409,
    );
    assert.equal(
      (await principal.view()).records.find((row) => row.id === application)
        ?.status,
      'pending',
    );
    await create(principal, {
      action: 'decide',
      id: application,
      version: 1,
      status: 'admitted',
      roll: '90',
      effectiveOn: day,
      note: 'Admission approved',
    });
    const admission = (await principal.view()).records.find(
      (row) => row.id === application,
    )!;
    assert(
      await one(
        db,
        'SELECT id FROM enrolment WHERE id=? AND roll=?',
        String(admission.data.studentId),
        '90',
      ),
    );
    await create(
      principal,
      {
        action: 'decide',
        id: application,
        version: 2,
        status: 'admitted',
        roll: '91',
        effectiveOn: day,
        note: 'Double admission',
      },
      409,
    );
    const payroll = await create(accounts, {
      action: 'payroll',
      staffId: 'teacher.a',
      month: day.slice(0, 7),
      gross: 5000010,
      deductions: 100005,
      note: 'Prepared salary',
    });
    assert.equal(
      (await accounts.view()).records.find((row) => row.id === payroll)?.data
        .net,
      4900005,
    );
    await create(
      accounts,
      {
        action: 'payroll',
        staffId: 'teacher.a',
        month: day.slice(0, 7),
        gross: 5000010,
        deductions: 0,
        note: 'Duplicate month',
      },
      409,
    );
    await create(
      accounts,
      {
        action: 'decide',
        id: payroll,
        version: 1,
        status: 'approved',
        note: 'Needs principal',
      },
      403,
    );
    await create(accounts, {
      action: 'revise-payroll',
      id: payroll,
      version: 1,
      staffId: 'teacher.a',
      month: day.slice(0, 7),
      gross: 5100010,
      deductions: 100005,
      note: 'Corrected allowance',
    });
    await create(principal, {
      action: 'decide',
      id: payroll,
      version: 2,
      status: 'approved',
      note: 'Salary checked',
    });
    await create(
      accounts,
      {
        action: 'revise-payroll',
        id: payroll,
        version: 3,
        staffId: 'teacher.a',
        month: day.slice(0, 7),
        gross: 5200010,
        deductions: 0,
        note: 'Cannot alter approved',
      },
      409,
    );
    await create(
      accounts,
      {
        action: 'payroll',
        staffId: 'support.a',
        month: day.slice(0, 7),
        gross: 20.5,
        deductions: 0,
        note: 'Fractional paise',
      },
      400,
    );
    const grant = await create(accounts, {
      action: 'grant',
      title: 'Learning materials',
      reference: 'SANCTION-1',
      amount: 100000,
      day,
      note: 'Approved allocation',
    });
    const expense = {
      action: 'expense',
      grantId: grant,
      amount: 70000,
      reference: 'VOUCHER-1',
      day,
      note: 'Materials purchased',
    };
    await create(accounts, expense);
    await create(
      accounts,
      { ...expense, amount: 40000, reference: 'VOUCHER-2' },
      409,
    );
    await create(
      accounts,
      { ...expense, amount: 100, reference: 'VOUCHER-1' },
      409,
    );
    const race = await Promise.all([
      create(accounts, { ...expense, amount: 30000, reference: 'VOUCHER-2' }),
      accounts.call({
        schoolId: 'school-a',
        ...expense,
        amount: 30000,
        reference: 'VOUCHER-3',
      }),
    ]);
    assert.equal((race[1] as Response).status, 409);
    const item = await create(support, {
      action: 'inventory',
      title: 'Chairs',
      code: 'CHAIR-1',
      unit: 'pieces',
      quantity: 5,
      note: 'Opening count',
    });
    const movement = {
      action: 'movement',
      itemId: item,
      direction: 'issue',
      quantity: 3,
      day,
      note: 'Issued to class 5',
    };
    await create(support, movement);
    await create(support, { ...movement, quantity: 3 }, 409);
    await create(support, {
      ...movement,
      direction: 'receive',
      quantity: 1,
      note: 'Returned from classroom',
    });
    await create(teacher, movement, 403);
    const event = await create(principal, {
      action: 'calendar',
      title: 'Parent meeting',
      start: '2026-12-01',
      end: '2026-12-01',
      audience: 'parents',
      category: 'meeting',
      note: 'Meet class teachers',
    });
    await create(principal, {
      action: 'calendar',
      title: 'Staff meeting',
      start: day,
      end: day,
      audience: 'staff',
      category: 'meeting',
      note: 'Internal meeting',
    });
    assert.deepEqual(
      (await parent.view()).records.map((row) => row.id),
      [event],
    );
    assert(!(await teacher.view()).records.some((row) => row.id === event));
    await create(principal, {
      action: 'decide',
      id: event,
      version: 1,
      status: 'cancelled',
      note: 'Meeting postponed',
    });
    assert.equal((await parent.view()).records[0].status, 'cancelled');
    assert.equal((await other.view()).records.length, 0);
    assert(
      (await accounts.view()).records.every((row) =>
        ['payroll', 'grant', 'expense', 'calendar'].includes(row.kind),
      ),
    );
    const audit = await one<{ note: string }>(
      db,
      "SELECT note FROM school_activity WHERE target_id=? AND action='operations staff-attendance' AND json_extract(note,'$.after.version')=2",
      attendance,
    );
    assert.equal(JSON.parse(audit!.note).before.status, 'present');
    assert.equal(JSON.parse(audit!.note).after.status, 'leave');
    await run(db, "DELETE FROM class_assignment WHERE account_id='teacher.a'");
    assert.equal((await teacher.view()).records.length, 0);
    await create(
      teacher,
      {
        action: 'leave',
        start: '2026-12-02',
        end: '2026-12-02',
        reason: 'Access revoked',
      },
      404,
    );
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
