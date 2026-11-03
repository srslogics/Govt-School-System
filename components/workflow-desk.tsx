'use client';
import { useState, type SyntheticEvent } from 'react';
import { useDemoAuth } from './demo-auth';
import { useSchoolRecords } from './school-records';
import { AccessibleDialog } from './accessible-dialog';
import {
  schoolScope,
  schoolList,
  visibleRequests,
  allowedTransitions,
  canReadAction,
  type Status,
} from '@/lib/school-workflow';
export function WorkflowDesk({
  view = 'Requests',
  embedded = false,
}: {
  view?: string;
  embedded?: boolean;
}) {
  const { session } = useDemoAuth(),
    { state, save } = useSchoolRecords(),
    [tab, setTab] = useState('All'),
    [q, setQ] = useState(''),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [remarks, setRemarks] = useState(''),
    [error, setError] = useState('');
  const Heading = embedded ? 'h2' : 'h1';
  const visible = visibleRequests(state, session),
    request = visible.find((r) => r.id === selected),
    actions = state.actions.filter((a) => canReadAction(a, session));
  const categoryByView: Record<string, string> = {
    Inspections: 'Inspection',
    Compliance: 'Infrastructure',
    Staff: 'Staffing',
    Finance: 'Grant',
    Assets: 'Infrastructure',
    Students: 'Student support',
    Attendance: 'Student support',
    Assessment: 'Student support',
    'Student support': 'Student support',
    'My service': 'Staffing',
    Entitlements: 'Student support',
    'Help & grievance': 'Grievance',
  };
  const rows = visible.filter(
    (r) =>
      (!categoryByView[view] || r.category === categoryByView[view]) &&
      (!/approvals/i.test(view) ||
        ['Submitted', 'Under review'].includes(r.status)) &&
      (tab === 'All' || r.status === tab) &&
      (
        r.title +
        ' ' +
        r.id +
        ' ' +
        schoolList.find((s) => s.id === r.schoolId)?.name
      )
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const activity = /audit|history|activity|sync|validation|data sources/i.test(
      view,
    ),
    schools = /^schools$/i.test(view),
    config = /user access|configuration/i.test(view),
    drafts = /offline drafts/i.test(view),
    reports = /reports|briefing/i.test(view);
  function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (name: string) => {
        const v = f.get(name);
        return typeof v === 'string' ? v : '';
      };
    try {
      save({
        kind: 'create',
        schoolId: get('school'),
        title: get('title'),
        category: get('category'),
        description: get('description'),
      });
      setOpen(false);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function transition(status: Status) {
    if (!request) return;
    try {
      save({ kind: 'transition', id: request.id, status, remarks });
      setRemarks('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function exportRecords() {
    const csv = [
        ['Reference', 'School', 'Subject', 'Status'],
        ...visible.map((r) => [
          r.id,
          schoolList.find((s) => s.id === r.schoolId)?.name || '',
          r.title,
          r.status,
        ]),
      ]
        .map((row) =>
          row
            .map(
              (v) =>
                '"' + v.replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"',
            )
            .join(','),
        )
        .join('\r\n'),
      a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    );
    a.download = 'school-workflows-demo.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <section className="workflow-desk">
      <div className="page-head">
        <div>
          <span>CONNECTED DEMONSTRATION WORKSPACE</span>
          <Heading>
            {activity
              ? 'Saved activity & history'
              : schools
                ? 'Assigned schools'
                : config
                  ? 'Demo access assignment'
                  : drafts
                    ? 'Saved request drafts'
                    : reports
                      ? 'Workflow report'
                      : categoryByView[view]
                        ? view + ' requests'
                        : 'School requests & decisions'}
          </Heading>
        </div>
        <div>
          <button className="outline" onClick={exportRecords}>
            Export workflows
          </button>
          {session.app !== 'mis' && !activity && !config && !schools && (
            <button
              className="wf-primary"
              onClick={() => {
                setOpen(true);
                setError('');
              }}
            >
              New school request
            </button>
          )}
        </div>
      </div>
      <p className="workflow-help">
        {session.office} ·{' '}
        {schoolScope(session)
          .map((s) => s.name)
          .join(' / ')}
        . Records persist on this browser across demo-profile changes. They are
        not shared between devices.
      </p>
      {config ? (
        <div className="block wf-access">
          <h2>{session.name}</h2>
          <p>{session.role}</p>
          <p>
            Profile: {session.userId} · Application: {session.app}
          </p>
          <p>
            Demo assignment only. Change profiles through Sign out. Production
            access requires server-side authorization.
          </p>
        </div>
      ) : schools ? (
        <div className="block">
          {schoolScope(session).map((s) => (
            <div className="wf-school" key={s.id}>
              <strong>{s.name}</strong>
              <span>{s.block} Block</span>
              <span>
                {visible.filter((r) => r.schoolId === s.id).length} saved
                requests
              </span>
            </div>
          ))}
        </div>
      ) : activity ? (
        <div className="block">
          <h2 className="wf-heading">Request transitions</h2>
          {visible.flatMap((r) =>
            r.history.map((h, i) => (
              <div className="wf-history" key={r.id + i}>
                <strong>
                  {r.id} · {h.action}
                </strong>
                <span>
                  {h.actor} · {new Date(h.at).toLocaleString('en-IN')}
                </span>
                <p>{h.remarks}</p>
              </div>
            )),
          )}
          <h2 className="wf-heading">Saved module actions</h2>
          {actions.length ? (
            actions
              .slice()
              .reverse()
              .map((a) => (
                <div className="wf-history" key={a.id}>
                  <strong>
                    {a.reference} · {a.status}
                  </strong>
                  <span>
                    {a.actor} · {new Date(a.at).toLocaleString('en-IN')}
                  </span>
                  <p>{a.title}</p>
                  <p>{a.remarks}</p>
                </div>
              ))
          ) : (
            <p className="wf-empty">
              No module actions have been recorded by your permitted profiles.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="wf-metrics">
            {[
              'Draft',
              'Submitted',
              'Under review',
              'Approved',
              'Returned',
              'Closed',
            ].map((s) => (
              <div key={s}>
                <span>{s}</span>
                <strong>{visible.filter((r) => r.status === s).length}</strong>
              </div>
            ))}
          </div>
          <div className="register-tools">
            <label>
              Search requests
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Reference, subject or school"
              />
            </label>
            <label>
              Status
              <select value={tab} onChange={(e) => setTab(e.target.value)}>
                {[
                  'All',
                  'Draft',
                  'Submitted',
                  'Under review',
                  'Returned',
                  'Approved',
                  'Rejected',
                  'Closed',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="block table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Reference',
                    'School',
                    'Subject',
                    'Status',
                    'Last update',
                    'Action',
                  ].map((s) => (
                    <th key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => !drafts || r.status === 'Draft')
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>
                        {schoolList.find((s) => s.id === r.schoolId)?.name}
                      </td>
                      <td>{r.title}</td>
                      <td>{r.status}</td>
                      <td>
                        {new Date(r.history.at(-1)!.at).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected(r.id);
                            setRemarks('');
                            setError('');
                          }}
                        >
                          Open request
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="wf-empty">
                No matching requests. Create a request as School Office, submit
                it, then review it using the assigned officer profile.
              </p>
            )}
          </div>
        </>
      )}
      {open && (
        <AccessibleDialog
          label="New school request"
          onClose={() => setOpen(false)}
        >
          <form onSubmit={submit}>
            <header>
              <h2>New school request</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="file-body">
              <label>
                School
                <select name="school">
                  {schoolScope(session).map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select name="category">
                  {[
                    'Staffing',
                    'Infrastructure',
                    'Inspection',
                    'Grant',
                    'Student support',
                    'Grievance',
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input name="title" required maxLength={160} />
              </label>
              <label>
                Request details
                <textarea name="description" required maxLength={2000} />
              </label>
              {error && (
                <p role="alert" className="auth-error">
                  {error}
                </p>
              )}
            </div>
            <footer>
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit">Save draft</button>
            </footer>
          </form>
        </AccessibleDialog>
      )}
      {request && (
        <AccessibleDialog
          label={'School request ' + request.id}
          onClose={() => setSelected(null)}
        >
          <header>
            <div>
              <span>
                {request.id} · {request.status}
              </span>
              <h2>{request.title}</h2>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close request"
            >
              ×
            </button>
          </header>
          <div className="file-body">
            <p>{schoolList.find((s) => s.id === request.schoolId)?.name}</p>
            <p>{request.description}</p>
            <h3>Saved history</h3>
            {request.history.map((h, i) => (
              <div className="wf-history" key={i}>
                <strong>
                  {h.action} · {h.actor}
                </strong>
                <span>{new Date(h.at).toLocaleString('en-IN')}</span>
                <p>{h.remarks}</p>
              </div>
            ))}
            {allowedTransitions(request, session).length > 0 && (
              <label>
                Remarks required
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={2000}
                />
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer>
            <button onClick={() => setSelected(null)}>Close</button>
            {allowedTransitions(request, session).map((status) => (
              <button key={status} onClick={() => transition(status)}>
                {status === 'Under review'
                  ? 'Record review'
                  : status === 'Submitted'
                    ? 'Submit request'
                    : status === 'Closed'
                      ? 'Confirm completion'
                      : status}
              </button>
            ))}
          </footer>
        </AccessibleDialog>
      )}
    </section>
  );
}
