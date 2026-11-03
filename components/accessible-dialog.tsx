'use client';
import { useEffect, useRef, type ReactNode } from 'react';
export function AccessibleDialog({
  label,
  onClose,
  children,
  overlayClass = 'overlay',
  panelClass = 'file-sheet',
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  overlayClass?: string;
  panelClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null,
      bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ) || [],
      );
    (focusable()[0] || root)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      }
      if (e.key === 'Tab') {
        const all = focusable(),
          first = all[0],
          last = all.at(-1);
        if (!first) {
          e.preventDefault();
          root?.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === root)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = bodyOverflow;
      if (prior?.isConnected) prior.focus();
    };
  }, []);
  return (
    <div className={overlayClass}>
      <dialog
        open
        ref={ref}
        className={panelClass}
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </dialog>
    </div>
  );
}
