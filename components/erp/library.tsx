'use client';
import { readActivityNote } from '@/lib/erp/activity-note';
import { RecordPreview } from './record-preview';

import { useEffect, useState, type SubmitEvent } from 'react';
import { todayInNagpur, type Workspace } from '@/lib/erp/model';
import type {
  Borrower,
  LibraryBook,
  LibraryCopy,
  LibraryLoan,
  LibraryView,
} from '@/lib/erp/library';
import { errorMessage, request } from './client';
const sections = [
  ['home', 'Library home'],
  ['catalogue', 'Catalogue'],
  ['loans', 'Issue & returns'],
  ['overdue', 'Overdue'],
  ['history', 'Borrowing history'],
];
function afterWeek() {
  const value = new Date(todayInNagpur() + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + 7);
  return value.toISOString().slice(0, 10);
}
export function LibraryPanel({
  workspace,
  view = 'home',
  onNavigate,
}: {
  workspace: Workspace;
  view?: string;
  onNavigate: (view: string) => void;
}) {
  const parent = workspace.account.role === 'parent',
    principal = workspace.account.role === 'principal',
    today = todayInNagpur();
  const [school, setSchool] = useState(workspace.schools[0]?.id ?? ''),
    [data, setData] = useState<LibraryView>(),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [query, setQuery] = useState(''),
    [borrowerQuery, setBorrowerQuery] = useState(''),
    [borrowers, setBorrowers] = useState<Borrower[]>([]),
    [student, setStudent] = useState(''),
    [borrowerId, setBorrowerId] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    request<LibraryView>(
      `library?school=${encodeURIComponent(school)}`,
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      });
    return () => controller.abort();
  }, [school, reload]);
  useEffect(() => {
    if (parent || view !== 'loans') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      request<Borrower[]>(
        `library-borrowers?school=${encodeURIComponent(school)}&q=${encodeURIComponent(borrowerQuery)}`,
        undefined,
        controller.signal,
      )
        .then((rows) => {
          if (!controller.signal.aborted) setBorrowers(rows);
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) setError(errorMessage(failure));
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [school, borrowerQuery, parent, view]);
  async function save(
    event: SubmitEvent<HTMLFormElement>,
    action: string,
    row?: LibraryBook | LibraryCopy | LibraryLoan,
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      payload = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('library', {
        ...payload,
        schoolId: school,
        action,
        ...(row ? { id: row.id, version: row.version } : {}),
      });
      setData(
        await request<LibraryView>(
          `library?school=${encodeURIComponent(school)}`,
        ),
      );
      form.reset();
      if (action === 'issue') setBorrowerId('');
      setMessage(
        action === 'issue'
          ? 'Book issued.'
          : action === 'return'
            ? 'Loan closed and copy availability updated.'
            : action === 'renew'
              ? 'Loan renewed.'
              : 'Library record saved.',
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const ready = data?.schoolId === school,
    books = ready ? data.books : [],
    copies = ready ? data.copies : [],
    loans = ready ? data.loans : [];
  const active = loans.filter((row) => !row.closedOn),
    overdue = active.filter((row) => row.dueOn < today),
    search = query.trim().toLowerCase();
  const filteredBooks = books.filter((row) =>
    `${row.title} ${row.author} ${row.code} ${row.isbn} ${row.category}`
      .toLowerCase()
      .includes(search),
  );
  const bookFields = (book?: LibraryBook) => (
    <>
      <label>
        Catalogue code
        <input name="code" required maxLength={50} defaultValue={book?.code} />
      </label>
      <label>
        Book title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={book?.title}
        />
      </label>
      <label>
        Author
        <input
          name="author"
          required
          maxLength={120}
          defaultValue={book?.author}
        />
      </label>
      <label>
        Book category
        <input
          name="category"
          required
          maxLength={80}
          defaultValue={book?.category}
        />
      </label>
      <label>
        Language
        <input
          name="language"
          required
          maxLength={50}
          defaultValue={book?.language}
        />
      </label>
      <label>
        ISBN (optional)
        <input name="isbn" maxLength={30} defaultValue={book?.isbn} />
      </label>
      <label>
        Shelf / location
        <input
          name="shelf"
          required
          maxLength={80}
          defaultValue={book?.shelf}
        />
      </label>
    </>
  );
  function loanCard(row: LibraryLoan) {
    return (
      <article className="erp-portal-record" key={`${row.id}:${row.version}`}>
        <header>
          <h3>
            {row.title} · {row.accession}
          </h3>
          <span
            className={`erp-status erp-${row.closedOn ? 'closed' : row.dueOn < today ? 'absent' : 'open'}`}
          >
            {row.closedOn
              ? row.outcome
              : row.dueOn < today
                ? 'Overdue'
                : 'Borrowed'}
          </span>
        </header>
        <p>
          {row.studentName} · {row.classLabel}
        </p>
        <p>
          Issued {row.issuedOn} · Due {row.dueOn}
          {row.closedOn ? ` · Closed ${row.closedOn}` : ''}
        </p>
        <p>{row.issueNote}</p>
        {row.closeNote && <blockquote>{row.closeNote}</blockquote>}
        <small>
          Issued by {row.issuer}
          {row.closer ? ` · Closed by ${row.closer}` : ''} · Version{' '}
          {row.version}
        </small>
        {!parent && !row.closedOn && (
          <>
            <details>
              <summary>Record return or loss</summary>
              <form
                className="erp-portal-form"
                onSubmit={(event) => void save(event, 'return', row)}
              >
                <label>
                  Return / closure date
                  <input
                    name="closedOn"
                    type="date"
                    required
                    defaultValue={today}
                    min={row.issuedOn}
                    max={today}
                  />
                </label>
                <label>
                  Return outcome
                  <select name="outcome">
                    <option value="returned">Returned in good condition</option>
                    <option value="damaged">Returned damaged</option>
                    <option value="lost">Reported lost</option>
                  </select>
                </label>
                <label>
                  Return / loss note
                  <textarea name="note" required maxLength={1000} />
                </label>
                <button disabled={busy}>Save book return</button>
              </form>
            </details>
            <details>
              <summary>Renew loan</summary>
              <form
                className="erp-portal-form"
                onSubmit={(event) => void save(event, 'renew', row)}
              >
                <label>
                  Renewed due date
                  <input
                    name="dueOn"
                    type="date"
                    required
                    min={today}
                    defaultValue={afterWeek()}
                  />
                </label>
                <label>
                  Renewal reason
                  <textarea name="note" required maxLength={1000} />
                </label>
                <button disabled={busy}>Save loan renewal</button>
              </form>
            </details>
          </>
        )}
        {!parent && (
          <details>
            <summary>Loan history</summary>
            {data?.history
              .filter((item) => item.targetId === row.id)
              .map((item) => {
                const detail = readActivityNote(item.note);
                return (
                  <p key={item.id}>
                    {item.actor} ·{' '}
                    {new Date(item.at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}{' '}
                    · {detail.note}
                  </p>
                );
              })}
          </details>
        )}
      </article>
    );
  }
  return (
    <section className="erp-library">
      {principal && (
        <nav className="erp-section-tabs" aria-label="Library sections">
          {sections.map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="erp-portal-section-heading">
        <div>
          <h3>
            {parent
              ? 'Your child’s library books'
              : (sections.find(([id]) => id === view)?.[1] ?? 'School library')}
          </h3>
          <p>Current library records · {today}</p>
        </div>
        <button type="button" onClick={() => setReload((value) => value + 1)}>
          Refresh library
        </button>
      </div>
      <label>
        Library school
        <select
          value={school}
          onChange={(event) => {
            setSchool(event.target.value);
            setBorrowers([]);
            setBorrowerId('');
            setStudent('');
            setMessage('');
          }}
        >
          {!workspace.schools.length && (
            <option value="">No assigned school</option>
          )}
          {workspace.schools.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="erp-error">
          {error}
        </p>
      )}
      {message && <output className="erp-success">{message}</output>}
      {!data || !ready ? (
        <output>Loading library records…</output>
      ) : (
        <>
          {(parent || view === 'home') && (
            <>
              <div className="erp-portal-metrics">
                {parent ? (
                  <>
                    <div>
                      <strong>{data.stats.borrowed}</strong>
                      <span>Books currently borrowed</span>
                    </div>
                    <div>
                      <strong>{data.stats.overdue}</strong>
                      <span>Overdue books</span>
                    </div>
                    <div>
                      <strong>{data.stats.closed}</strong>
                      <span>Closed loans</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{data.stats.titles}</strong>
                      <span>Catalogue titles</span>
                    </div>
                    <div>
                      <strong>
                        {data.stats.available}/{data.stats.copies}
                      </strong>
                      <span>Available / total copies</span>
                    </div>
                    <div>
                      <strong>{data.stats.borrowed}</strong>
                      <span>Books on loan</span>
                    </div>
                    <div>
                      <strong>{data.stats.overdue}</strong>
                      <span>Overdue books</span>
                    </div>
                  </>
                )}
              </div>
              {!parent && (
                <>
                  <div className="erp-portal-next">
                    <button
                      type="button"
                      onClick={() => onNavigate('catalogue')}
                    >
                      Manage catalogue & copies
                    </button>
                    <button type="button" onClick={() => onNavigate('loans')}>
                      Issue or return a book
                    </button>
                    <button type="button" onClick={() => onNavigate('overdue')}>
                      Follow up overdue books
                    </button>
                    <button type="button" onClick={() => onNavigate('history')}>
                      Find student borrowing history
                    </button>
                  </div>
                  <p>
                    {data.stats.damaged} damaged · {data.stats.lost} lost ·{' '}
                    {data.stats.withdrawn} withdrawn copies. School inventory is
                    separate from this copy-by-copy library register.
                  </p>
                  <h3>Due today</h3>
                  <RecordPreview
                    key={`${view}:0`}
                    className="erp-portal-records"
                    label="Library loans"
                  >
                    {active.filter((row) => row.dueOn === today).map(loanCard)}
                  </RecordPreview>
                  {!active.some((row) => row.dueOn === today) && (
                    <p>No books are due today.</p>
                  )}
                </>
              )}
              {parent && (
                <>
                  <h3>Current borrowing</h3>
                  <RecordPreview
                    key={`${view}:1`}
                    className="erp-portal-records"
                    label="Library loans"
                  >
                    {active.map(loanCard)}
                  </RecordPreview>
                  {!active.length && (
                    <p>No books are currently borrowed by your linked child.</p>
                  )}
                  <h3>Previous borrowing</h3>
                  <RecordPreview
                    key={`${view}:2`}
                    className="erp-portal-records"
                    label="Library loans"
                  >
                    {loans.filter((row) => row.closedOn).map(loanCard)}
                  </RecordPreview>
                  {!loans.some((row) => row.closedOn) && (
                    <p>No previous borrowing records yet.</p>
                  )}
                  <p>
                    Only your linked child’s loans are shown. Ask the school
                    librarian about returns or renewals.
                  </p>
                </>
              )}
            </>
          )}
          {!parent && view === 'catalogue' && (
            <>
              <details className="erp-operations-create">
                <summary>Add catalogue title</summary>
                <form
                  className="erp-portal-form"
                  onSubmit={(event) => void save(event, 'book')}
                >
                  {bookFields()}
                  <button className="erp-primary" disabled={busy}>
                    Save catalogue title
                  </button>
                </form>
              </details>
              <label>
                Find catalogue title
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Title, author, catalogue code or ISBN"
                />
              </label>
              <RecordPreview
                key={`${view}:3`}
                className="erp-portal-records"
                label="Library records"
                searchable={false}
              >
                {filteredBooks.map((book) => (
                  <article
                    className="erp-portal-record"
                    key={`${book.id}:${book.version}`}
                  >
                    <h3>{book.title}</h3>
                    <p>
                      {book.author} · {book.category} · {book.language}
                    </p>
                    <p>
                      Code {book.code} · Shelf {book.shelf}
                      {book.isbn ? ` · ISBN ${book.isbn}` : ''}
                    </p>
                    <p>
                      {
                        copies.filter(
                          (copy) =>
                            copy.bookId === book.id &&
                            copy.state === 'active' &&
                            !copy.loanId,
                        ).length
                      }{' '}
                      available of{' '}
                      {copies.filter((copy) => copy.bookId === book.id).length}{' '}
                      copies
                    </p>
                    <details>
                      <summary>Add physical copy</summary>
                      <form
                        className="erp-portal-form"
                        onSubmit={(event) => void save(event, 'copy')}
                      >
                        <input type="hidden" name="bookId" value={book.id} />
                        <label>
                          Accession number
                          <input name="accession" required maxLength={60} />
                        </label>
                        <label>
                          Copy acquisition note
                          <textarea name="note" required maxLength={1000} />
                        </label>
                        <button disabled={busy}>Save book copy</button>
                      </form>
                    </details>
                    <details>
                      <summary>Edit catalogue details</summary>
                      <form
                        className="erp-portal-form"
                        onSubmit={(event) =>
                          void save(event, 'edit-book', book)
                        }
                      >
                        {bookFields(book)}
                        <label>
                          Catalogue correction reason
                          <textarea name="note" required maxLength={1000} />
                        </label>
                        <button disabled={busy}>
                          Save catalogue correction
                        </button>
                      </form>
                    </details>
                    <div className="erp-scroll">
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Accession</th>
                            <th>Copy status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {copies
                            .filter((copy) => copy.bookId === book.id)
                            .map((copy) => (
                              <tr key={`${copy.id}:${copy.version}`}>
                                <td>{copy.accession}</td>
                                <td>
                                  {copy.loanId
                                    ? 'On loan'
                                    : copy.state === 'active'
                                      ? 'Available'
                                      : copy.state}
                                </td>
                                <td>
                                  {!copy.loanId && (
                                    <details>
                                      <summary>Change copy state</summary>
                                      <form
                                        onSubmit={(event) =>
                                          void save(event, 'copy-state', copy)
                                        }
                                      >
                                        <label>
                                          Copy state
                                          <select
                                            name="state"
                                            defaultValue={copy.state}
                                          >
                                            <option value="active">
                                              Available after check / repair
                                            </option>
                                            <option value="damaged">
                                              Damaged
                                            </option>
                                            <option value="lost">Lost</option>
                                            <option value="withdrawn">
                                              Withdrawn
                                            </option>
                                          </select>
                                        </label>
                                        <label>
                                          Copy state reason
                                          <textarea
                                            name="note"
                                            required
                                            maxLength={1000}
                                          />
                                        </label>
                                        <button disabled={busy}>
                                          Save copy state
                                        </button>
                                      </form>
                                    </details>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </RecordPreview>
              {!filteredBooks.length && (
                <p>
                  No catalogue titles match. Add a title, then add its physical
                  copies.
                </p>
              )}
            </>
          )}
          {!parent && view === 'loans' && (
            <>
              <details className="erp-operations-create">
                <summary>Issue book to student</summary>
                <form
                  className="erp-portal-form"
                  onSubmit={(event) => void save(event, 'issue')}
                >
                  <label>
                    Available book copy
                    <select name="copyId" required defaultValue="">
                      <option value="" disabled>
                        Choose available copy
                      </option>
                      {copies
                        .filter(
                          (copy) => copy.state === 'active' && !copy.loanId,
                        )
                        .map((copy) => (
                          <option key={copy.id} value={copy.id}>
                            {
                              books.find((book) => book.id === copy.bookId)
                                ?.title
                            }{' '}
                            · {copy.accession}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Find borrower
                    <input
                      value={borrowerQuery}
                      onChange={(event) => {
                        setBorrowerQuery(event.target.value);
                        setBorrowerId('');
                      }}
                      placeholder="Student name, roll or class"
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Student borrower
                    <select
                      name="studentId"
                      required
                      value={borrowerId}
                      onChange={(event) => setBorrowerId(event.target.value)}
                    >
                      <option value="" disabled>
                        Choose student
                      </option>
                      {borrowers.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · {row.classLabel} · Roll {row.roll}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Showing up to 50 matching enrolled learners. Search to find
                    another learner. Issue and return notes are visible to
                    linked families.
                  </p>
                  <label>
                    Issue date
                    <input
                      name="issuedOn"
                      type="date"
                      required
                      defaultValue={today}
                      max={today}
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      name="dueOn"
                      type="date"
                      required
                      defaultValue={afterWeek()}
                    />
                  </label>
                  <label>
                    Issue note
                    <textarea name="note" required maxLength={1000} />
                  </label>
                  <button
                    className="erp-primary"
                    disabled={
                      busy ||
                      !copies.some(
                        (copy) => copy.state === 'active' && !copy.loanId,
                      )
                    }
                  >
                    Issue selected book
                  </button>
                </form>
              </details>
              <h3>Books currently on loan</h3>
              <RecordPreview
                key={`${view}:4`}
                className="erp-portal-records"
                label="Library loans"
              >
                {active.map(loanCard)}
              </RecordPreview>
              {!active.length && <p>No books are currently on loan.</p>}
            </>
          )}
          {!parent && view === 'overdue' && (
            <>
              <p>
                Open loans with a due date before {today}. Due-today books are
                not overdue.
              </p>
              <RecordPreview
                key={`${view}:5`}
                className="erp-portal-records"
                label="Library loans"
              >
                {overdue.map(loanCard)}
              </RecordPreview>
              {!overdue.length && <p>No overdue books in this school.</p>}
            </>
          )}
          {!parent && view === 'history' && (
            <>
              <label>
                Find student or book
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Student name, class, title or accession"
                />
              </label>
              <label>
                Filter borrower
                <select
                  value={student}
                  onChange={(event) => setStudent(event.target.value)}
                >
                  <option value="">All borrowers in loaded history</option>
                  {[
                    ...new Map(
                      loans.map((row) => [row.studentId, row]),
                    ).values(),
                  ].map((row) => (
                    <option key={row.studentId} value={row.studentId}>
                      {row.studentName} · {row.classLabel}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                All open loans and the most recent 200 closed loans are shown.
                Summary counts include the complete school history.
              </p>
              <RecordPreview
                key={`${view}:6`}
                className="erp-portal-records"
                label="Library loans"
              >
                {loans
                  .filter(
                    (row) =>
                      (!student || row.studentId === student) &&
                      `${row.studentName} ${row.classLabel} ${row.title} ${row.accession}`
                        .toLowerCase()
                        .includes(search),
                  )
                  .map(loanCard)}
              </RecordPreview>
              {!loans.length && <p>No borrowing history yet.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
