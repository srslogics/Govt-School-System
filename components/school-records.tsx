'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDemoAuth } from './demo-auth';
import {
  STORE_KEY,
  emptyState,
  validState,
  applyCommand,
  visibleRequests,
  canReadAction,
  type SchoolState,
  type Command,
} from '@/lib/school-workflow';
type RecordsContext = {
  state: SchoolState;
  save: (cmd: Command) => void;
  warning: string;
};
const Context = createContext<RecordsContext | null>(null);
export function useSchoolRecords() {
  const value = useContext(Context);
  if (!value) throw Error('Records provider is missing');
  return value;
}
export function SchoolRecordsProvider({ children }: { children: ReactNode }) {
  const { session } = useDemoAuth(),
    [state, setState] = useState(emptyState),
    [warning, setWarning] = useState(''),
    [ready, setReady] = useState(false),
    observed = useRef<string | null>(null),
    recovery = useRef<string | null>(null),
    current = useRef(state);
  function update(s: SchoolState) {
    current.current = s;
    setState(s);
  }
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        observed.current = raw;
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (!validState(parsed)) throw Error('Invalid saved records');
          update(parsed);
        }
      } catch {
        recovery.current = observed.current;
        setWarning(
          'Saved records could not be loaded, or storage is unavailable. Existing text has been preserved. Download a recovery copy before resetting damaged records.',
        );
      }
      setReady(true);
    });
    const change = (e: StorageEvent) => {
      if (e.key !== STORE_KEY && e.key !== null) return;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw === null) {
          observed.current = null;
          update(emptyState());
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!validState(parsed)) throw Error('Invalid');
        observed.current = raw;
        update(parsed);
        setWarning(
          'Records refreshed from another tab. Review the latest status before saving.',
        );
      } catch {
        setWarning(
          'Records changed in another tab and need review. Current records remain open.',
        );
      }
    };
    window.addEventListener('storage', change);
    return () => {
      active = false;
      window.removeEventListener('storage', change);
    };
  }, []);
  function save(cmd: Command) {
    if (!ready) throw Error('Wait for records to load.');
    if (recovery.current !== null)
      throw Error(
        'Saved records need recovery. Download a copy and reset explicitly before editing.',
      );
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORE_KEY);
    } catch {
      raw = observed.current;
    }
    if (raw !== observed.current)
      throw Error(
        'Another tab changed the records. Refresh and review before saving.',
      );
    const next = applyCommand(current.current, session, cmd),
      serialized = JSON.stringify(next);
    try {
      localStorage.setItem(STORE_KEY, serialized);
      observed.current = serialized;
      setWarning('');
    } catch {
      setWarning(
        'Storage is unavailable. Changes last only for this visit; export a recovery copy before leaving.',
      );
    }
    update(next);
  }
  function download() {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              format: 'school-demo-recovery',
              state: {
                ...current.current,
                requests: visibleRequests(current.current, session),
                actions: current.current.actions.filter((a) =>
                  canReadAction(a, session),
                ),
              },
              originalSavedText: ['executive', 'mis'].includes(session.app)
                ? recovery.current
                : undefined,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
      a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'school-demo-recovery.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function reset() {
    if (session.app !== 'executive' && session.app !== 'mis') return;
    if (
      !confirm(
        'Replace saved demonstration records? Download a recovery copy first if needed.',
      )
    )
      return;
    const s = emptyState();
    s.revision = current.current.revision + 1;
    try {
      const raw = JSON.stringify(s);
      localStorage.setItem(STORE_KEY, raw);
      observed.current = raw;
      recovery.current = null;
      setWarning('');
      update(s);
    } catch {
      setWarning('Storage is blocked. Saved records could not be reset.');
    }
  }
  if (!ready) return <output>Loading saved demonstration records…</output>;
  return (
    <Context.Provider value={{ state, save, warning }}>
      <div className="records-bar">
        <span>
          Demonstration · records saved in this browser · no live government
          connections
        </span>
        <div>
          <button onClick={download}>Download recovery copy</button>
          {['executive', 'mis'].includes(session.app) && (
            <button onClick={reset}>Reset demo records</button>
          )}
        </div>
      </div>
      {warning && <output className="demo-storage-warning">{warning}</output>}
      {children}
    </Context.Provider>
  );
}
