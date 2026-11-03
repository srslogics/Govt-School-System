export type DemoSession = {
  userId: string;
  name: string;
  office: string;
  role: string;
  app: string;
};

type DemoAccount = DemoSession & { password: string };

export const accounts: DemoAccount[] = [
  {
    userId: 'district.admin',
    password: 'Nagpur@2026',
    name: 'District Administrator',
    office: 'District Education Office, Nagpur',
    role: 'Education Officer — Primary',
    app: 'executive',
  },
  {
    userId: 'commissioner',
    password: 'Nagpur@2026',
    name: 'Municipal Commissioner',
    office: 'Nagpur Municipal Corporation',
    role: 'Municipal Commissioner',
    app: 'executive',
  },
  {
    userId: 'field.officer',
    password: 'Nagpur@2026',
    name: 'Block Education Officer',
    office: 'Hingna Block',
    role: 'Block Education Officer — Hingna',
    app: 'field',
  },
  {
    userId: 'headmaster',
    password: 'Nagpur@2026',
    name: 'Headmaster',
    office: 'Z.P. Upper Primary School, Parseoni',
    role: 'Headmaster',
    app: 'school',
  },
  {
    userId: 'teacher',
    password: 'Nagpur@2026',
    name: 'Class Teacher',
    office: 'Class VIII A',
    role: 'Class Teacher — VIII A',
    app: 'teacher',
  },
  {
    userId: 'parent',
    password: 'Nagpur@2026',
    name: 'Parent / Guardian',
    office: 'Family & SMC',
    role: 'Parent / Guardian',
    app: 'community',
  },
  {
    userId: 'mis.admin',
    password: 'Nagpur@2026',
    name: 'District MIS Officer',
    office: 'District MIS Cell',
    role: 'District MIS Officer',
    app: 'mis',
  },
  {
    userId: 'parseoni.officer',
    password: 'Nagpur@2026',
    name: 'Parseoni Field Officer',
    office: 'Parseoni Block',
    role: 'Block Education Officer — Parseoni',
    app: 'field',
  },
];

export function canonicalSession(value: unknown): DemoSession | null {
  if (!value || typeof value !== 'object' || !('userId' in value)) return null;
  const account = accounts.find((a) => a.userId === value.userId);
  if (!account) return null;
  const { password: _, ...session } = account;
  return session;
}
