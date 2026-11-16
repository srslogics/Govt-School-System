import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const browser = new Window({ url: 'http://localhost/erp?preview=compact' });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'Node',
  'MutationObserver',
  'Event',
  'KeyboardEvent',
])
  Object.defineProperty(globalThis, key, {
    value: (browser as unknown as Record<string, unknown>)[key],
    configurable: true,
  });
Object.defineProperty(globalThis, 'navigator', {
  value: browser.navigator,
  configurable: true,
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup } =
  await import('@testing-library/react');
const { RecordPreview, CompactPreviewContext } =
  await import('../components/erp/record-preview');
function records(count = 25) {
  return Array.from({ length: count }, (_, i) => (
    <article key={i}>
      <h3>Learner {i + 1}</h3>
      <p>Mathematics result</p>
      <form>
        <label>
          Note for learner {i + 1}
          <input defaultValue="" />
        </label>
      </form>
    </article>
  ));
}
function visibleSlots(container: HTMLElement) {
  return container.querySelectorAll('.erp-preview-record-slot:not([hidden])')
    .length;
}

void test('compact paging and search retain off-page form drafts and keep every record reachable', () => {
  try {
    const { container, rerender } = render(
      <CompactPreviewContext value>
        <RecordPreview label="Results">{records()}</RecordPreview>
      </CompactPreviewContext>,
    );
    assert.equal(visibleSlots(container), 4);
    const note = screen.getByLabelText('Note for learner 1');
    fireEvent.change(note, { target: { value: 'Keep this unsaved note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next results page' }));
    assert.equal(visibleSlots(container), 4);
    assert.ok(note.closest('.erp-preview-record-slot')!.hasAttribute('hidden'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Previous results page' }),
    );
    assert.equal(
      (screen.getByLabelText('Note for learner 1') as HTMLInputElement).value,
      'Keep this unsaved note',
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search results' }),
      { target: { value: 'Learner 25' } },
    );
    assert.equal(visibleSlots(container), 1);
    assert.equal(
      container.querySelector('.erp-preview-record-slot:not([hidden]) h3')!
        .textContent,
      'Learner 25',
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search results' }),
      { target: { value: '' } },
    );
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Results per page' }),
      { target: { value: '8' } },
    );
    assert.equal(visibleSlots(container), 8);
    rerender(
      <CompactPreviewContext value={false}>
        <RecordPreview label="Results">{records()}</RecordPreview>
      </CompactPreviewContext>,
    );
    assert.equal(container.querySelectorAll('[hidden]').length, 0);
    assert.equal(
      (screen.getByLabelText('Note for learner 1') as HTMLInputElement).value,
      'Keep this unsaved note',
    );
    rerender(
      <CompactPreviewContext value>
        <RecordPreview label="Results">{records()}</RecordPreview>
      </CompactPreviewContext>,
    );
    assert.equal(visibleSlots(container), 8);

    for (let n = 0; n < 3; n++)
      fireEvent.click(
        screen.getByRole('button', { name: 'Next results page' }),
      );
    assert.equal(visibleSlots(container), 1);
    assert.ok(
      (
        screen.getByRole('button', {
          name: 'Next results page',
        }) as HTMLButtonElement
      ).disabled,
    );
  } finally {
    cleanup();
  }
});

void test('current layout stays unpaged, while filtered compact lists preserve a way to clear search', () => {
  try {
    const normal = render(
      <RecordPreview label="Results">{records(12)}</RecordPreview>,
    );
    assert.equal(normal.container.querySelectorAll('article').length, 12);
    assert.equal(
      screen.queryByRole('navigation', { name: 'Results pages' }),
      null,
    );
    cleanup();
    const preview = (count: number) => (
      <CompactPreviewContext value>
        <RecordPreview label="Results">{records(count)}</RecordPreview>
      </CompactPreviewContext>
    );
    const view = render(preview(12));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'no matching learner' },
    });
    assert.equal(visibleSlots(view.container), 0);
    view.rerender(preview(3));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    assert.equal(visibleSlots(view.container), 3);
  } finally {
    cleanup();
  }
});

void test('custom assessment cards can be found by their authorised record fields', () => {
  function Result({ row }: { row: { studentName: string; subject: string } }) {
    return (
      <article>
        <h3>{row.studentName}</h3>
        <p>{row.subject}</p>
      </article>
    );
  }
  try {
    const { container } = render(
      <CompactPreviewContext value>
        <RecordPreview label="Assessments">
          {Array.from({ length: 12 }, (_, i) => (
            <Result
              key={i}
              row={{
                studentName: `Student ${i + 1}`,
                subject: i === 10 ? 'Science' : 'English',
              }}
            />
          ))}
        </RecordPreview>
      </CompactPreviewContext>,
    );
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Science' },
    });
    assert.equal(visibleSlots(container), 1);
    assert.equal(
      container.querySelector('.erp-preview-record-slot:not([hidden]) h3')!
        .textContent,
      'Student 11',
    );
  } finally {
    cleanup();
  }
});
