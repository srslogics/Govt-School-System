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
import type { Borrower, LibraryView } from '../lib/erp/library';

void test('library catalogue, copy availability, circulation, renewals, damaged/lost recovery and child/school isolation persist atomically', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'library-')),
    file = join(directory, 'test.sqlite'),
    db = openFileDatabase(file);
  try {
    await initializeDatabase(db);
    await seedFictionalSchools(db, () => 'Library-Test-1234');
    const day = todayInNagpur(),
      yesterdayDate = new Date(day + 'T12:00:00Z'),
      futureDate = new Date(day + 'T12:00:00Z');
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    futureDate.setUTCDate(futureDate.getUTCDate() + 7);
    const yesterday = yesterdayDate.toISOString().slice(0, 10),
      future = futureDate.toISOString().slice(0, 10);
    await run(db, 'UPDATE class_section SET effective_on=?', yesterday);
    await run(db, 'UPDATE enrolment SET effective_on=?', yesterday);
    const origin = 'http://localhost',
      handler = createHandler(db, origin);
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
        (await call('login', { username, password: 'Library-Test-1234' }))
          .status,
        200,
      );
      return {
        call,
        view: async (school = 'school-a') =>
          (await (
            await call('library?school=' + school)
          ).json()) as LibraryView,
      };
    };
    const librarian = await client('library.a'),
      principal = await client('principal.a'),
      other = await client('principal.b'),
      parent = await client('parent.a'),
      otherParent = await client('parent.b'),
      teacher = await client('teacher.a'),
      officer = await client('officer.a');
    const save = async (
      who: typeof librarian,
      body: Record<string, unknown>,
      expected = 200,
    ) => {
      const response = await who.call('library', {
        schoolId: 'school-a',
        ...body,
      });
      const result = (await response.json()) as { id: string };
      assert.equal(response.status, expected, JSON.stringify(result));
      return result.id;
    };
    const title = {
      action: 'book',
      code: 'READ-1',
      title: 'Fictional Reading Book',
      author: 'Sample Author',
      category: 'Reading',
      language: 'English',
      isbn: '',
      shelf: 'A-1',
    };
    assert.equal((await teacher.call('library')).status, 403);
    assert.equal((await officer.call('library')).status, 403);
    await save(parent, title, 403);
    await save(other, title, 404);
    const book = await save(librarian, title);
    await save(librarian, { ...title, code: 'read-1' }, 409);
    await save(principal, {
      ...title,
      action: 'edit-book',
      id: book,
      version: 1,
      title: 'Fictional Reading Book — revised',
      note: 'Catalogue spelling corrected',
    });
    await save(
      librarian,
      {
        ...title,
        action: 'edit-book',
        id: book,
        version: 1,
        note: 'Stale update',
      },
      409,
    );
    const copy = await save(librarian, {
      action: 'copy',
      bookId: book,
      accession: 'ACC-1',
      note: 'Acquired for school library',
    });
    await save(
      librarian,
      {
        action: 'copy',
        bookId: book,
        accession: 'acc-1',
        note: 'Duplicate accession',
      },
      409,
    );
    const otherBook = await save(other, { ...title, schoolId: 'school-b' });
    await save(
      librarian,
      {
        action: 'copy',
        bookId: otherBook,
        accession: 'FOREIGN',
        note: 'Cross-school title',
      },
      404,
    );
    const borrowers = (await (
      await librarian.call('library-borrowers?school=school-a&q=A-2')
    ).json()) as Borrower[];
    assert.equal(borrowers.length, 1);
    assert.equal(borrowers[0].id, 'class-a-student-2');
    assert(!JSON.stringify(borrowers).includes('guardian'));
    assert.equal(
      (await parent.call('library-borrowers?school=school-a')).status,
      403,
    );
    const issue = {
      action: 'issue',
      copyId: copy,
      studentId: 'class-a-student-1',
      issuedOn: yesterday,
      dueOn: yesterday,
      note: 'Shared family-visible issue note',
    };
    await save(librarian, { ...issue, studentId: 'class-b-student-1' }, 404);
    await save(librarian, { ...issue, issuedOn: future, dueOn: future }, 400);
    const issued = await Promise.all([
      librarian.call('library', { schoolId: 'school-a', ...issue }),
      principal.call('library', { schoolId: 'school-a', ...issue }),
    ]);
    assert.deepEqual(
      issued.map((r) => r.status).sort((a, b) => a - b),
      [200, 409],
    );
    const loan = (
      (await issued.find((r) => r.status === 200)!.json()) as { id: string }
    ).id;
    let view = await librarian.view();
    assert.equal(view.stats.available, 0);
    assert.equal(view.stats.borrowed, 1);
    assert.equal(view.stats.overdue, 1);
    await save(
      librarian,
      {
        action: 'copy-state',
        id: copy,
        version: 1,
        state: 'withdrawn',
        note: 'Cannot withdraw borrowed copy',
      },
      409,
    );
    await save(principal, {
      action: 'renew',
      id: loan,
      version: 1,
      dueOn: future,
      note: 'Extra reading time approved',
    });
    await save(
      librarian,
      {
        action: 'renew',
        id: loan,
        version: 1,
        dueOn: future,
        note: 'Stale renewal',
      },
      409,
    );
    assert.equal((await librarian.view()).stats.overdue, 0);
    const secondCopy = await save(librarian, {
      action: 'copy',
      bookId: book,
      accession: 'ACC-2',
      note: 'Second physical copy',
    });
    const secondLoan = await save(librarian, {
      ...issue,
      copyId: secondCopy,
      studentId: 'class-a-student-2',
      issuedOn: day,
      dueOn: day,
      note: 'Another child private borrowing note',
    });
    const family = await parent.view();
    assert.equal(family.loans.length, 1);
    assert.equal(family.loans[0].studentId, 'class-a-student-1');
    assert.equal(family.books.length, 0);
    assert.equal(family.copies.length, 0);
    assert.equal(family.history.length, 0);
    assert(
      !JSON.stringify(family).includes('Another child private borrowing note'),
    );
    assert.equal(family.stats.borrowed, 1);
    assert.equal(
      (await otherParent.call('library?school=school-a')).status,
      404,
    );
    await save(librarian, {
      action: 'return',
      id: loan,
      version: 2,
      closedOn: day,
      outcome: 'damaged',
      note: 'Cover damaged; needs repair',
    });
    view = await librarian.view();
    assert.equal(view.stats.damaged, 1);
    assert.equal(view.stats.available, 0);
    await save(librarian, { ...issue, issuedOn: day, dueOn: future }, 409);
    await save(
      librarian,
      {
        action: 'return',
        id: loan,
        version: 3,
        closedOn: day,
        outcome: 'returned',
        note: 'Already closed',
      },
      409,
    );
    await save(librarian, {
      action: 'copy-state',
      id: copy,
      version: 2,
      state: 'active',
      note: 'Cover repaired and checked',
    });
    const finalLoan = await save(librarian, {
      ...issue,
      issuedOn: day,
      dueOn: day,
      note: 'Reissued after repair',
    });
    await save(
      librarian,
      {
        action: 'return',
        id: finalLoan,
        version: 1,
        closedOn: yesterday,
        outcome: 'returned',
        note: 'Impossible return chronology',
      },
      400,
    );
    await save(librarian, {
      action: 'return',
      id: finalLoan,
      version: 1,
      closedOn: day,
      outcome: 'lost',
      note: 'Family reported copy lost',
    });
    assert.equal((await librarian.view()).stats.lost, 1);
    await save(librarian, {
      action: 'copy-state',
      id: copy,
      version: 4,
      state: 'active',
      note: 'Lost book recovered and checked',
    });
    assert.equal((await librarian.view()).stats.available, 1);
    await save(principal, {
      action: 'return',
      id: secondLoan,
      version: 1,
      closedOn: day,
      outcome: 'returned',
      note: 'Returned in good condition',
    });
    view = await librarian.view();
    assert.equal(view.stats.available, 2);
    assert.equal(view.stats.closed, 3);
    assert.equal(view.stats.borrowed, 0);
    assert(
      view.history.some(
        (h) =>
          (JSON.parse(h.note) as { note: string }).note ===
          'Cover repaired and checked',
      ),
    );
    const persisted = openFileDatabase(file);
    try {
      assert.equal(
        (
          await one<{ count: number }>(
            persisted,
            'SELECT COUNT(*) AS count FROM library_loan WHERE closed_on IS NOT NULL',
          )
        )?.count,
        3,
      );
    } finally {
      persisted.close();
    }
    await run(db, "DELETE FROM guardian_link WHERE account_id='parent.a'");
    assert.equal(
      ((await (await parent.call('library')).json()) as LibraryView).loans
        .length,
      0,
    );
    assert.equal((await parent.call('library?school=school-a')).status, 404);
    await run(db, "DELETE FROM school_assignment WHERE account_id='library.a'");
    await save(librarian, title, 404);
    assert.equal(
      (await librarian.call('library-borrowers?school=school-a')).status,
      404,
    );
    assert.equal((await db.execute('PRAGMA foreign_key_check')).rows.length, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
