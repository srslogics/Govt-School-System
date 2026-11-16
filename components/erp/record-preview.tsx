'use client';

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export const CompactPreviewContext = createContext(false);

function recordText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(recordText).join(' ');
  if (
    !isValidElement<{ children?: ReactNode; row?: Record<string, unknown> }>(
      node,
    )
  )
    return '';
  if (
    typeof node.type === 'string' &&
    ['form', 'button', 'input', 'select', 'textarea', 'details'].includes(
      node.type,
    )
  )
    return '';
  if (node.props.row)
    return [
      'title',
      'name',
      'studentName',
      'subject',
      'exam',
      'status',
      'feedback',
      'score',
    ]
      .map((key) => node.props.row?.[key])
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .join(' ');
  return recordText(node.props.children);
}

/** Record paging. Keep record forms mounted so paging and search retain drafts. */
export function RecordPreview({
  children,
  className,
  label = 'Records',
  searchable = true,
  presentation = 'list',
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  searchable?: boolean;
  presentation?: 'list' | 'grid';
}) {
  const compact = useContext(CompactPreviewContext);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [size, setSize] = useState(4);
  const [page, setPage] = useState(0);
  function goTo(next: number) {
    setPage(next);
    list.current?.scrollIntoView?.({ block: 'start' });
  }
  const items = Children.toArray(children).filter((item) =>
    isValidElement(item),
  );
  const matched = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      recordText(item)
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase()
        .includes(query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()),
    );
  const pages = Math.max(1, Math.ceil(matched.length / size));
  const current = Math.min(page, pages - 1);
  const visible = new Set(
    matched
      .slice(current * size, (current + 1) * size)
      .map(({ index }) => index),
  );

  return (
    <div
      ref={list}
      className={`${className ?? ''}${compact ? ` erp-record-preview erp-record-preview--${presentation}` : ''}`}
    >
      {compact && (items.length > 4 || query) && searchable && (
        <div className="erp-record-preview-tools">
          <label className="erp-record-search" htmlFor={id}>
            <Search size={14} />
            <span className="erp-visually-hidden">
              Search {label.toLowerCase()}
            </span>
            <input
              id={id}
              type="search"
              value={query}
              placeholder={`Search ${label.toLowerCase()}`}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <span>{items.length} total</span>
        </div>
      )}
      {items.map((item, index) => (
        <div
          className="erp-preview-record-slot"
          key={item.key ?? index}
          hidden={compact && !visible.has(index)}
        >
          {item}
        </div>
      ))}
      {compact && !matched.length && items.length > 0 && (
        <output className="erp-preview-no-match">
          No matching records. Try another search.
        </output>
      )}
      {compact && (items.length > 4 || query) && (
        <nav className="erp-record-pager" aria-label={`${label} pages`}>
          <output>
            {matched.length
              ? `${current * size + 1}–${Math.min((current + 1) * size, matched.length)}`
              : '0'}{' '}
            of {matched.length}
            {query ? ' matches' : ''}
          </output>
          <label>
            Show
            <select
              aria-label={`${label} per page`}
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {[4, 8, 16].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label={`Previous ${label.toLowerCase()} page`}
            disabled={current === 0}
            onClick={() => goTo(current - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            aria-label={`Next ${label.toLowerCase()} page`}
            disabled={current === pages - 1}
            onClick={() => goTo(current + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}
