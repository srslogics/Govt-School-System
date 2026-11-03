'use client';
import { useState } from 'react';
import { useDemoAuth } from './demo-auth';
import { useSchoolRecords } from './school-records';
import { WorkflowDesk } from './workflow-desk';
import {
  visibleRequests,
  allowedTransitions,
  schoolList,
} from '@/lib/school-workflow';
import { moduleAccess } from '@/lib/demo-access';
const copy: Record<string, { title: string; intro: string; primary: string }> =
  {
    executive: {
      title: 'Your decisions & follow-up',
      intro: 'See the school requests that need a district decision.',
      primary: 'Review my queue',
    },
    field: {
      title: 'Your assigned school reviews',
      intro: 'Review submitted requests from the schools assigned to you.',
      primary: 'Review my queue',
    },
    school: {
      title: 'Your school, your next steps',
      intro: 'Submit a request, respond to an officer and track the decision.',
      primary: 'Create school request',
    },
    teacher: {
      title: 'Your classroom & service requests',
      intro:
        'Raise a student-support or service request and track its progress.',
      primary: 'Create a request',
    },
    community: {
      title: 'Your requests & school updates',
      intro:
        'Raise a concern and follow the response from your school and officers.',
      primary: 'Raise a concern',
    },
    mis: {
      title: 'Your data & activity workspace',
      intro:
        'Review saved workflow records, assignments and demonstration activity.',
      primary: 'Review saved activity',
    },
  };
export function RoleHome({
  onNavigate,
}: {
  onNavigate: (module: string) => void;
}) {
  const { session } = useDemoAuth(),
    { state } = useSchoolRecords(),
    [view, setView] = useState('home'),
    [selected, setSelected] = useState<string | undefined>(),
    [create, setCreate] = useState(false);
  const text = copy[session.app],
    records = visibleRequests(state, session),
    attention = records.filter(
      (r) => allowedTransitions(r, session).length > 0,
    ),
    open = records.filter((r) => !['Closed', 'Rejected'].includes(r.status)),
    waiting = open.filter((r) => !attention.includes(r));
  function go(target: string) {
    setView(target);
    setSelected(undefined);
    setCreate(target === 'new');
  }
  if (view !== 'home')
    return (
      <>
        <button
          className="my-work-back"
          onClick={() => {
            setView('home');
            setSelected(undefined);
            setCreate(false);
          }}
        >
          ← Back to My work
        </button>
        <WorkflowDesk
          key={view + selected}
          view={
            view === 'history'
              ? 'Saved activity'
              : view === 'assignment'
                ? 'User access'
                : 'Requests'
          }
          attentionOnly={view === 'attention'}
          waitingOnly={view === 'waiting'}
          openOnly={view === 'open'}
          initialSelected={selected}
          initialCreate={create}
          initialCategory={
            session.app === 'community'
              ? 'Grievance'
              : session.app === 'teacher'
                ? 'Student support'
                : session.app === 'field'
                  ? 'Inspection'
                  : session.app === 'school'
                    ? 'Infrastructure'
                    : 'Staffing'
          }
        />
      </>
    );
  return (
    <section className="my-work">
      <div className="my-work-heading">
        <div>
          <span>{session.office}</span>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
        <button
          className="wf-primary"
          onClick={() =>
            go(
              session.app === 'mis'
                ? 'history'
                : ['executive', 'field'].includes(session.app)
                  ? 'attention'
                  : 'new',
            )
          }
        >
          {text.primary}
        </button>
      </div>
      <div className="my-work-counts">
        <button onClick={() => go('attention')}>
          <strong>{attention.length}</strong>
          <span>Need your action</span>
        </button>
        <button onClick={() => go('open')}>
          <strong>{open.length}</strong>
          <span>Open requests</span>
        </button>
        <button onClick={() => go('waiting')}>
          <strong>{waiting.length}</strong>
          <span>Waiting on someone else</span>
        </button>
      </div>
      <section className="block my-attention">
        <header>
          <div>
            <h2>What needs your attention?</h2>
            <p>These counts come from saved records.</p>
          </div>
          <button className="text-button" onClick={() => go('requests')}>
            See all requests
          </button>
        </header>
        {attention.length ? (
          attention.map((r) => (
            <button
              className="attention-item"
              key={r.id}
              onClick={() => {
                setSelected(r.id);
                setCreate(false);
                setView('request');
              }}
            >
              <div>
                <small>
                  {r.id} · {schoolList.find((s) => s.id === r.schoolId)?.name}
                </small>
                <strong>{r.title}</strong>
                <span>
                  {r.status} ·{' '}
                  {allowedTransitions(r, session)
                    .map((s) =>
                      s === 'Submitted'
                        ? 'Submit'
                        : s === 'Closed'
                          ? 'Confirm completion'
                          : s === 'Under review'
                            ? 'Review'
                            : s,
                    )
                    .join(' / ')}
                </span>
              </div>
              <b aria-hidden="true">→</b>
            </button>
          ))
        ) : (
          <div className="my-work-empty">
            <strong>Nothing is waiting for your action.</strong>
            <p>
              {session.app === 'mis'
                ? 'Open saved activity or assignments to continue.'
                : records.length
                  ? 'You can check the progress of your requests or start a new one.'
                  : 'Create a request to begin the connected school-to-officer demonstration.'}
            </p>
          </div>
        )}
      </section>
      <div className="my-work-links">
        <button onClick={() => go('requests')}>
          Track requests <span>Statuses, decisions and replies →</span>
        </button>
        <button onClick={() => go('history')}>
          View history <span>Saved remarks and actions →</span>
        </button>
        {session.app !== 'mis' && (
          <button onClick={() => go('new')}>
            Start a new request <span>Choose a school and category →</span>
          </button>
        )}
      </div>
      <details className="more-tools">
        <summary>More tools & reference registers</summary>
        <div>
          {(moduleAccess[session.app] || []).map((m) => (
            <button
              className="text-button"
              key={m}
              onClick={() => onNavigate(m)}
            >
              {m}
            </button>
          ))}
          <button
            className="text-button"
            onClick={() => {
              setView('assignment');
              setCreate(false);
            }}
          >
            View my demo assignment
          </button>
        </div>
        <p>
          Reference registers retain their illustrative figures. Saved request
          counts above update with your actions.
        </p>
      </details>
    </section>
  );
}
