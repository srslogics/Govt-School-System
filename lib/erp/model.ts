export const roles = [
  'administrator',
  'teacher',
  'principal',
  'officer',
  'commissioner',
] as const;
export type Role = (typeof roles)[number];
export const marks = ['present', 'absent', 'leave'] as const;
export type Mark = (typeof marks)[number];
export type RegisterStatus = 'submitted' | 'reviewed' | 'returned';
export type CoverageStatus = RegisterStatus | 'not submitted' | 'no enrolment';

export type Account = {
  id: string;
  username: string;
  name: string;
  role: Role;
};
export type School = { id: string; code: string; name: string };
export type ClassSection = {
  id: string;
  schoolId: string;
  grade: string;
  section: string;
};
export type Student = { id: string; name: string; roll: string };
export type AttendanceEntry = Student & { mark: Mark };
export type HistoryEvent = {
  actor: string;
  action: 'submitted' | 'returned' | 'resubmitted' | 'reviewed';
  at: string;
  note: string;
  changedMarks: number;
};
export type RegisterView = {
  school: School;
  classSection: ClassSection;
  date: string;
  roster: Student[];
  register: {
    status: RegisterStatus;
    version: number;
    entries: AttendanceEntry[];
  } | null;
  history: HistoryEvent[];
};
export type Counts = {
  expected: number;
  submitted: number;
  reviewed: number;
  returned: number;
  missing: number;
  present: number;
  absent: number;
  leave: number;
  total: number;
};
export type Coverage = {
  classSection: ClassSection;
  status: CoverageStatus;
  enrolled: number;
  counts: Counts;
};
export type Report = {
  date: string;
  totals: Counts;
  schools: { school: School; totals: Counts; classes?: Coverage[] }[];
};
export type Workspace = {
  account: Account;
  date: string;
  schools: School[];
  classes: ClassSection[];
};
export type Setup = {
  schools: School[];
  classes: ClassSection[];
  staff: Account[];
  assignments: { accountId: string; targetId: string }[];
  enrolments: (Student & { classId: string; effectiveOn: string })[];
};

export function todayInNagpur() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return [value('year'), value('month'), value('day')].join('-');
}

export function attendanceRate(counts: Counts) {
  return counts.total
    ? `${((100 * counts.present) / counts.total).toFixed(1)}%`
    : '—';
}
