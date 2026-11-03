import { canonicalSession, type DemoSession } from './demo-accounts';
export const STORE_KEY = 'shikshan-setu-records-v1';
export const schoolList = [
  { id: 'hingna', name: 'Z.P. Primary School, Hingna', block: 'Hingna' },
  {
    id: 'wanadongri',
    name: 'Z.P. Primary School, Wanadongri',
    block: 'Hingna',
  },
  {
    id: 'parseoni',
    name: 'Z.P. Upper Primary School, Parseoni',
    block: 'Parseoni',
  },
];
export type Status =
  | 'Draft'
  | 'Submitted'
  | 'Under review'
  | 'Returned'
  | 'Approved'
  | 'Rejected'
  | 'Closed';
export type History = {
  at: string;
  actor: string;
  role: string;
  action: string;
  remarks: string;
};
export type RequestRecord = {
  id: string;
  schoolId: string;
  category: string;
  title: string;
  description: string;
  createdBy: string;
  status: Status;
  history: History[];
};
export type ActionRecord = {
  id: string;
  reference: string;
  title: string;
  app: string;
  actor: string;
  remarks: string;
  status: string;
  at: string;
};
export type SchoolState = {
  version: 1;
  revision: number;
  sequence: number;
  requests: RequestRecord[];
  actions: ActionRecord[];
};
export const emptyState = (): SchoolState => ({
  version: 1,
  revision: 0,
  sequence: 0,
  requests: [],
  actions: [],
});
export function schoolScope(session: DemoSession) {
  if (['executive', 'mis'].includes(session.app)) return schoolList;
  if (session.app === 'field')
    return schoolList.filter(
      (s) =>
        s.block ===
        (session.userId === 'parseoni.officer' ? 'Parseoni' : 'Hingna'),
    );
  return schoolList.filter((s) => s.id === 'parseoni');
}
export function visibleRequests(s: SchoolState, actor: DemoSession) {
  const schools = schoolScope(actor);
  return s.requests.filter(
    (r) =>
      schools.some((s) => s.id === r.schoolId) &&
      (['executive', 'mis', 'field', 'school'].includes(actor.app) ||
        r.createdBy === actor.userId),
  );
}
export function canReadAction(a: ActionRecord, session: DemoSession) {
  return (
    ['executive', 'mis'].includes(session.app) || a.actor === session.userId
  );
}
export function allowedTransitions(r: RequestRecord, a: DemoSession): Status[] {
  const origin = r.createdBy === a.userId;
  if (origin && ['Draft', 'Returned'].includes(r.status)) return ['Submitted'];
  if (origin && r.status === 'Approved') return ['Closed'];
  if (origin) return [];
  if (a.app === 'field' && r.status === 'Submitted')
    return ['Under review', 'Returned'];
  if (a.app === 'executive' && r.status === 'Submitted')
    return ['Under review', 'Returned'];
  if (a.app === 'executive' && r.status === 'Under review')
    return ['Approved', 'Rejected', 'Returned'];
  return [];
}
const statuses: Status[] = [
  'Draft',
  'Submitted',
  'Under review',
  'Returned',
  'Approved',
  'Rejected',
  'Closed',
];
const string = (s: unknown, max = 500) =>
  typeof s === 'string' && s.trim().length > 0 && s.length <= max;
export function validState(value: unknown): value is SchoolState {
  try {
    const s = value as SchoolState;
    if (
      !s ||
      s.version !== 1 ||
      !Number.isSafeInteger(s.revision) ||
      s.revision < 0 ||
      !Number.isSafeInteger(s.sequence) ||
      s.sequence < 0 ||
      !Array.isArray(s.requests) ||
      !Array.isArray(s.actions) ||
      s.requests.length + s.actions.length > 10000
    )
      return false;
    const ids = new Set<string>();
    for (const r of s.requests) {
      if (
        !r ||
        !string(r.id) ||
        ids.has(r.id) ||
        !schoolList.some((x) => x.id === r.schoolId) ||
        !string(r.title, 160) ||
        !string(r.description, 2000) ||
        !string(r.category, 80) ||
        !string(r.createdBy) ||
        !statuses.includes(r.status) ||
        !Array.isArray(r.history) ||
        !r.history.length
      )
        return false;
      ids.add(r.id);
      if (
        !/^REQ-\d+$/.test(r.id) ||
        Number(r.id.split('-')[1]) > s.sequence ||
        r.history.at(-1)?.action !== r.status
      )
        return false;
      for (const h of r.history)
        if (
          !string(h.actor) ||
          !string(h.role) ||
          !string(h.action) ||
          !string(h.remarks, 2000) ||
          !Number.isFinite(Date.parse(h.at))
        )
          return false;
    }
    for (const r of s.actions) {
      if (
        !r ||
        !string(r.id) ||
        ids.has(r.id) ||
        !string(r.reference, 160) ||
        !string(r.title, 300) ||
        !string(r.app, 100) ||
        !string(r.actor) ||
        !string(r.status, 100) ||
        !string(r.remarks, 2000) ||
        !Number.isFinite(Date.parse(r.at))
      )
        return false;
      ids.add(r.id);
      if (!/^ACT-\d+$/.test(r.id) || Number(r.id.split('-')[1]) > s.sequence)
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
export type Command =
  | {
      kind: 'create';
      schoolId: string;
      category: string;
      title: string;
      description: string;
    }
  | { kind: 'transition'; id: string; status: Status; remarks: string }
  | {
      kind: 'action';
      reference: string;
      title: string;
      app: string;
      remarks: string;
      status: string;
    };
export function applyCommand(
  state: SchoolState,
  actor: DemoSession,
  cmd: Command,
): SchoolState {
  const canonical = canonicalSession(actor);
  if (
    !canonical ||
    canonical.app !== actor.app ||
    canonical.role !== actor.role
  )
    throw Error('Invalid demo actor profile.');
  if (!validState(state))
    throw Error('Saved records need recovery before editing.');
  const s = structuredClone(state),
    at = new Date().toISOString();
  const text = (v: string, max: number) => {
    if (!string(v, max))
      throw Error(
        'Complete all fields and keep remarks within ' + max + ' characters.',
      );
    return v.trim();
  };
  if (cmd.kind === 'create') {
    if (actor.app === 'mis')
      throw Error(
        'The MIS profile can review records but cannot submit school requests.',
      );
    if (!schoolScope(actor).some((s) => s.id === cmd.schoolId))
      throw Error('This school is outside your demo assignment.');
    s.requests.push({
      id: 'REQ-' + ++s.sequence,
      schoolId: cmd.schoolId,
      category: text(cmd.category, 80),
      title: text(cmd.title, 160),
      description: text(cmd.description, 2000),
      createdBy: actor.userId,
      status: 'Draft',
      history: [
        {
          at,
          actor: actor.userId,
          role: actor.role,
          action: 'Draft',
          remarks: cmd.description.trim(),
        },
      ],
    });
  } else if (cmd.kind === 'transition') {
    const r = s.requests.find((r) => r.id === cmd.id);
    if (!r || !visibleRequests(s, actor).some((x) => x.id === r.id))
      throw Error('Request is outside your assigned view.');
    if (!allowedTransitions(r, actor).includes(cmd.status))
      throw Error(
        'This status change is not permitted for this profile or current stage.',
      );
    r.status = cmd.status;
    r.history.push({
      at,
      actor: actor.userId,
      role: actor.role,
      action: cmd.status,
      remarks: text(cmd.remarks, 2000),
    });
  } else {
    if (
      !['executive', 'field', 'school', 'teacher', 'community', 'mis'].includes(
        actor.app,
      )
    )
      throw Error('Unknown demo profile.');
    const status = text(cmd.status, 100);
    if (
      ['Approved', 'Decision recorded'].includes(status) &&
      actor.app !== 'executive'
    )
      throw Error('District decisions require an Executive profile.');
    s.actions.push({
      id: 'ACT-' + ++s.sequence,
      reference: text(cmd.reference, 160),
      title: text(cmd.title, 300),
      app: actor.app,
      actor: actor.userId,
      remarks: text(cmd.remarks, 2000),
      status,
      at,
    });
  }
  s.revision++;
  if (!validState(s))
    throw Error('The record failed validation; nothing was saved.');
  return s;
}
