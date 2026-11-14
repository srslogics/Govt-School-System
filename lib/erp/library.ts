import { randomUUID } from 'node:crypto';
import { many, one, run, write, type Database, type Query } from './database';
import { workspace } from './attendance';
import { todayInNagpur, type Account, type School } from './model';
import { ErpError, missing, requiredText } from './validation';

export type LibraryBook = {
  id: string;
  schoolId: string;
  code: string;
  title: string;
  author: string;
  category: string;
  language: string;
  isbn: string;
  shelf: string;
  version: number;
};
export type LibraryCopy = {
  id: string;
  bookId: string;
  accession: string;
  state: 'active' | 'damaged' | 'lost' | 'withdrawn';
  version: number;
  loanId: string | null;
};
export type Borrower = {
  id: string;
  name: string;
  roll: string;
  classLabel: string;
};
export type LibraryLoan = {
  id: string;
  schoolId: string;
  copyId: string;
  bookId: string;
  accession: string;
  title: string;
  studentId: string;
  studentName: string;
  classLabel: string;
  issuedOn: string;
  dueOn: string;
  closedOn: string | null;
  outcome: string | null;
  issueNote: string;
  closeNote: string;
  issuer: string;
  closer: string | null;
  version: number;
};
export type LibraryView = {
  schoolId: string;
  schools: School[];
  books: LibraryBook[];
  copies: LibraryCopy[];
  loans: LibraryLoan[];
  stats: {
    titles: number;
    copies: number;
    available: number;
    borrowed: number;
    overdue: number;
    damaged: number;
    lost: number;
    withdrawn: number;
    closed: number;
  };
  history: {
    id: string;
    targetId: string;
    actor: string;
    note: string;
    at: string;
  }[];
};
const bookColumns =
  'SELECT id,school_id AS schoolId,code,title,author,category,language,isbn,shelf,version FROM library_book';
const copyColumns =
  'SELECT c.id,c.book_id AS bookId,c.accession,c.state,c.version,l.id AS loanId FROM library_copy c LEFT JOIN library_loan l ON l.copy_id=c.id AND l.closed_on IS NULL';
const loanColumns = `SELECT l.id,l.school_id AS schoolId,l.copy_id AS copyId,c.book_id AS bookId,c.accession,b.title,l.student_id AS studentId,e.name AS studentName,cs.grade||' · Section '||cs.section AS classLabel,l.issued_on AS issuedOn,l.due_on AS dueOn,l.closed_on AS closedOn,l.outcome,l.issue_note AS issueNote,l.close_note AS closeNote,a.name AS issuer,closer.name AS closer,l.version FROM library_loan l JOIN library_copy c ON c.id=l.copy_id JOIN library_book b ON b.id=c.book_id JOIN enrolment e ON e.id=l.student_id JOIN class_section cs ON cs.id=e.class_id JOIN account a ON a.id=l.issuer_id LEFT JOIN account closer ON closer.id=l.closer_id`;
function allow(account: Account, manage = false) {
  if (
    !(
      manage ? ['librarian', 'principal'] : ['librarian', 'principal', 'parent']
    ).includes(account.role)
  )
    throw new ErpError(
      403,
      manage
        ? 'Only the school librarian or principal can manage books and loans.'
        : 'Library records are available to librarians, principals and linked families.',
    );
}
async function scope(db: Query, account: Account, requested: string | null) {
  allow(account);
  const schools = (await workspace(db, account)).schools,
    schoolId = requested ?? schools[0]?.id ?? '';
  if (schoolId && !schools.some((s) => s.id === schoolId)) missing();
  return { schools, schoolId };
}
function day(value: unknown, label: string, future = true) {
  const text = requiredText(value, label, 10),
    parsed = new Date(text + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== text ||
    (!future && text > todayInNagpur())
  )
    throw new ErpError(
      400,
      `Choose a valid ${label.toLowerCase()}${future ? '' : ' no later than today'}.`,
    );
  return text;
}
export async function readBorrowers(
  db: Query,
  account: Account,
  school: string | null,
  query: string,
): Promise<Borrower[]> {
  allow(account, true);
  const { schoolId } = await scope(db, account, school);
  if (!schoolId) return [];
  if (query.length > 120)
    throw new ErpError(400, 'Search must be no more than 120 characters.');
  const text = query.trim().toLowerCase();
  return many(
    db,
    `SELECT e.id,e.name,e.roll,c.grade||' · Section '||c.section AS classLabel FROM enrolment e JOIN class_section c ON c.id=e.class_id WHERE c.school_id=? AND e.effective_on<=? AND c.effective_on<=? AND (instr(lower(e.name),?)>0 OR instr(lower(e.roll),?)>0 OR instr(lower(c.grade||' '||c.section),?)>0) ORDER BY c.grade,c.section,e.roll LIMIT 50`,
    schoolId,
    todayInNagpur(),
    todayInNagpur(),
    text,
    text,
    text,
  );
}
export async function readLibrary(
  db: Query,
  account: Account,
  requested: string | null,
): Promise<LibraryView> {
  const { schools, schoolId } = await scope(db, account, requested),
    result: LibraryView = {
      schoolId,
      schools,
      books: [],
      copies: [],
      loans: [],
      stats: {
        titles: 0,
        copies: 0,
        available: 0,
        borrowed: 0,
        overdue: 0,
        damaged: 0,
        lost: 0,
        withdrawn: 0,
        closed: 0,
      },
      history: [],
    };
  if (!schoolId) return result;
  const parent = account.role === 'parent',
    personal = parent
      ? ' AND EXISTS(SELECT 1 FROM guardian_link g WHERE g.enrolment_id=l.student_id AND g.account_id=?)'
      : '',
    args = [schoolId, ...(parent ? [account.id] : [])];
  // Keep every open loan visible; cap only resolved history, never availability or counts.
  result.loans = await many(
    db,
    `${loanColumns} WHERE l.school_id=? ${personal} AND (l.closed_on IS NULL OR l.id IN (SELECT id FROM library_loan WHERE school_id=? AND closed_on IS NOT NULL ${parent ? 'AND student_id IN (SELECT enrolment_id FROM guardian_link WHERE account_id=?)' : ''} ORDER BY closed_on DESC,id LIMIT 200)) ORDER BY l.closed_on IS NOT NULL,l.due_on,l.id`,
    ...args,
    schoolId,
    ...(parent ? [account.id] : []),
  );
  if (parent) {
    const totals = await one<{
      borrowed: number;
      overdue: number;
      closed: number;
    }>(
      db,
      `SELECT COALESCE(SUM(l.closed_on IS NULL),0) AS borrowed,COALESCE(SUM(l.closed_on IS NULL AND l.due_on<?),0) AS overdue,COALESCE(SUM(l.closed_on IS NOT NULL),0) AS closed FROM library_loan l WHERE l.school_id=? ${personal}`,
      todayInNagpur(),
      ...args,
    );
    Object.assign(result.stats, totals);
    return result;
  }
  result.books = await many(
    db,
    `${bookColumns} WHERE school_id=? ORDER BY title`,
    schoolId,
  );
  result.copies = await many(
    db,
    `${copyColumns} WHERE c.school_id=? ORDER BY c.accession`,
    schoolId,
  );
  result.stats.titles = result.books.length;
  result.stats.copies = result.copies.length;
  for (const copy of result.copies) {
    if (copy.loanId) result.stats.borrowed++;
    else if (copy.state === 'active') result.stats.available++;
    else result.stats[copy.state]++;
  }
  const counts = await one<{ overdue: number; closed: number }>(
    db,
    'SELECT COALESCE(SUM(closed_on IS NULL AND due_on<?),0) AS overdue,COALESCE(SUM(closed_on IS NOT NULL),0) AS closed FROM library_loan WHERE school_id=?',
    todayInNagpur(),
    schoolId,
  );
  Object.assign(result.stats, counts);
  result.history = await many(
    db,
    "SELECT h.id,h.target_id AS targetId,a.name AS actor,h.note,h.happened_at AS at FROM school_activity h JOIN account a ON a.id=h.actor_id WHERE h.school_id=? AND h.action LIKE 'library %' ORDER BY h.happened_at DESC",
    schoolId,
  );
  return result;
}
export async function updateLibrary(
  db: Database,
  account: Account,
  body: Record<string, unknown>,
) {
  allow(account, true);
  return write(db, async (tx) => {
    const schoolId = requiredText(body.schoolId, 'School');
    await scope(tx, account, schoolId);
    const action = requiredText(body.action, 'Action'),
      id = typeof body.id === 'string' && body.id ? body.id : randomUUID(),
      at = new Date().toISOString();
    let before: unknown = null,
      after: unknown;
    const version = (row: { version: number }) => {
      if (body.version !== row.version)
        throw new ErpError(
          409,
          'This library record changed. Refresh before continuing.',
        );
    };
    let note = '';
    if (action === 'book' || action === 'edit-book') {
      const existing = body.id
        ? await one<LibraryBook>(
            tx,
            `${bookColumns} WHERE id=? AND school_id=?`,
            id,
            schoolId,
          )
        : undefined;
      if (action === 'edit-book') {
        if (!existing) missing();
        version(existing);
      } else if (body.id)
        throw new ErpError(400, 'Create a new catalogue record.');
      const code = requiredText(body.code, 'Catalogue code', 50),
        title = requiredText(body.title, 'Book title', 200),
        author = requiredText(body.author, 'Author', 120),
        category = requiredText(body.category, 'Category', 80),
        language = requiredText(body.language, 'Language', 50),
        shelf = requiredText(body.shelf, 'Shelf / location', 80);
      const isbn = typeof body.isbn === 'string' ? body.isbn.trim() : '';
      if (isbn.length > 30)
        throw new ErpError(400, 'ISBN must be no more than 30 characters.');
      if (
        await one(
          tx,
          'SELECT id FROM library_book WHERE school_id=? AND code=? AND id<>?',
          schoolId,
          code,
          id,
        )
      )
        throw new ErpError(
          409,
          'This catalogue code already exists in the school.',
        );
      if (existing) {
        note = requiredText(body.note, 'Catalogue correction reason', 1000);
        before = existing;
        await run(
          tx,
          'UPDATE library_book SET code=?,title=?,author=?,category=?,language=?,isbn=?,shelf=?,version=version+1 WHERE id=?',
          code,
          title,
          author,
          category,
          language,
          isbn,
          shelf,
          id,
        );
      } else
        await run(
          tx,
          'INSERT INTO library_book VALUES (?,?,?,?,?,?,?,?,?,1)',
          id,
          schoolId,
          code,
          title,
          author,
          category,
          language,
          isbn,
          shelf,
        );
      after = {
        code,
        title,
        author,
        category,
        language,
        isbn,
        shelf,
        version: (existing?.version ?? 0) + 1,
      };
    } else if (action === 'copy') {
      if (body.id) throw new ErpError(400, 'Create a new copy record.');
      const bookId = requiredText(body.bookId, 'Book');
      if (
        !(await one(
          tx,
          'SELECT id FROM library_book WHERE id=? AND school_id=?',
          bookId,
          schoolId,
        ))
      )
        missing();
      const accession = requiredText(body.accession, 'Accession number', 60);
      if (
        await one(
          tx,
          'SELECT id FROM library_copy WHERE school_id=? AND accession=?',
          schoolId,
          accession,
        )
      )
        throw new ErpError(
          409,
          'This accession number already exists in the school.',
        );
      note = requiredText(body.note, 'Copy acquisition note', 1000);
      await run(
        tx,
        "INSERT INTO library_copy VALUES (?,?,?,?,'active',1)",
        id,
        schoolId,
        bookId,
        accession,
      );
      after = { bookId, accession, state: 'active', version: 1 };
    } else if (action === 'copy-state') {
      const copy = await one<LibraryCopy>(
        tx,
        `${copyColumns} WHERE c.id=? AND c.school_id=?`,
        id,
        schoolId,
      );
      if (!copy) missing();
      version(copy);
      if (copy.loanId)
        throw new ErpError(
          409,
          'Close the outstanding loan before changing this copy’s state.',
        );
      const state = requiredText(body.state, 'Copy state');
      if (!['active', 'damaged', 'lost', 'withdrawn'].includes(state))
        throw new ErpError(400, 'Choose a valid copy state.');
      note = requiredText(body.note, 'Copy state reason', 1000);
      before = copy;
      await run(
        tx,
        'UPDATE library_copy SET state=?,version=version+1 WHERE id=?',
        state,
        id,
      );
      after = { ...copy, state, version: copy.version + 1 };
    } else if (action === 'issue') {
      if (body.id) throw new ErpError(400, 'Create a new loan.');
      const copyId = requiredText(body.copyId, 'Book copy'),
        studentId = requiredText(body.studentId, 'Student');
      const copy = await one<LibraryCopy>(
        tx,
        `${copyColumns} WHERE c.id=? AND c.school_id=?`,
        copyId,
        schoolId,
      );
      if (!copy) missing();
      if (copy.state !== 'active' || copy.loanId)
        throw new ErpError(409, 'This copy is not available for issue.');
      const issuedOn = day(body.issuedOn, 'Issue date', false),
        dueOn = day(body.dueOn, 'Due date');
      if (dueOn < issuedOn)
        throw new ErpError(400, 'Due date must be on or after issue date.');
      if (
        !(await one(
          tx,
          'SELECT e.id FROM enrolment e JOIN class_section c ON c.id=e.class_id WHERE e.id=? AND c.school_id=? AND e.effective_on<=? AND c.effective_on<=?',
          studentId,
          schoolId,
          issuedOn,
          issuedOn,
        ))
      )
        missing();
      const previous = await one<{ last: string | null }>(
        tx,
        'SELECT MAX(closed_on) AS last FROM library_loan WHERE copy_id=?',
        copyId,
      );
      if (previous?.last && issuedOn < previous.last)
        throw new ErpError(
          400,
          'Issue date cannot precede the previous loan’s closing date.',
        );
      note = requiredText(body.note, 'Issue note', 1000);
      await run(
        tx,
        'INSERT INTO library_loan VALUES (?,?,?,?,?,?,NULL,NULL,?,?,?,NULL,1)',
        id,
        schoolId,
        copyId,
        studentId,
        issuedOn,
        dueOn,
        note,
        '',
        account.id,
      );
      after = {
        copyId,
        studentId,
        issuedOn,
        dueOn,
        status: 'borrowed',
        version: 1,
      };
    } else if (action === 'return' || action === 'renew') {
      const loan = await one<LibraryLoan>(
        tx,
        `${loanColumns} WHERE l.id=? AND l.school_id=?`,
        id,
        schoolId,
      );
      if (!loan) missing();
      version(loan);
      if (loan.closedOn)
        throw new ErpError(409, 'This loan has already been closed.');
      before = loan;
      if (action === 'renew') {
        const dueOn = day(body.dueOn, 'Renewed due date');
        if (dueOn <= loan.dueOn || dueOn < todayInNagpur())
          throw new ErpError(
            400,
            'Renewed due date must extend the current due date and be today or later.',
          );
        note = requiredText(body.note, 'Renewal reason', 1000);
        await run(
          tx,
          'UPDATE library_loan SET due_on=?,version=version+1 WHERE id=?',
          dueOn,
          id,
        );
        after = { ...loan, dueOn, version: loan.version + 1 };
      } else {
        const closedOn = day(body.closedOn, 'Return / closure date', false),
          outcome = requiredText(body.outcome, 'Return outcome');
        if (closedOn < loan.issuedOn)
          throw new ErpError(400, 'Return date cannot precede issue date.');
        if (!['returned', 'damaged', 'lost'].includes(outcome))
          throw new ErpError(400, 'Choose returned, damaged or lost.');
        note = requiredText(body.note, 'Return / loss note', 1000);
        await run(
          tx,
          'UPDATE library_loan SET closed_on=?,outcome=?,close_note=?,closer_id=?,version=version+1 WHERE id=?',
          closedOn,
          outcome,
          note,
          account.id,
          id,
        );
        await run(
          tx,
          'UPDATE library_copy SET state=?,version=version+1 WHERE id=?',
          outcome === 'returned' ? 'active' : outcome,
          loan.copyId,
        );
        after = {
          ...loan,
          closedOn,
          outcome,
          closeNote: note,
          version: loan.version + 1,
        };
      }
    } else throw new ErpError(400, 'Unknown library action.');
    await run(
      tx,
      'INSERT INTO school_activity VALUES (?,?,?,?,?,?,?)',
      randomUUID(),
      schoolId,
      account.id,
      id,
      'library ' + action,
      JSON.stringify({ note, before, after }),
      at,
    );
    return { ok: true, id };
  });
}
