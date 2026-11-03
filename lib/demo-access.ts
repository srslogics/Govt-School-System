import type { DemoSession } from './demo-accounts';
export const moduleAccess: Record<string, string[]> = {
  executive: [
    'District overview',
    'Executive review',
    'District risk map',
    'Student early warning',
    'Grievance escalation',
    'Schemes & entitlements',
    'Infrastructure & safety',
    'School register',
    'Officer hierarchy',
    'Staff position',
    'Inspection register',
    'Grants & works',
    'Data governance & audit',
  ],
  field: ['School register', 'Inspection register', 'Infrastructure & safety'],
  school: ['School register'],
  teacher: [],
  community: [],
  mis: ['School register', 'Data governance & audit'],
};
export function scopeText(text: string, session: DemoSession) {
  if (['executive', 'mis'].includes(session.app)) return true;
  return session.userId === 'field.officer'
    ? /Hingna|Wanadongri/i.test(text)
    : /Parseoni/i.test(text);
}
