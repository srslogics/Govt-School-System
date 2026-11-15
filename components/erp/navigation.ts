import type { Workspace } from '@/lib/erp/model';

type Role = Workspace['account']['role'];
export type WorkspaceLink = readonly [string, string];

export function initialPortalView(role: Role): string {
  return (
    (
      {
        parent: 'learning-home',
        teacher: 'teacher-day',
        principal: 'principal-overview',
        librarian: 'library-home',
        support: 'maintenance-home',
      } as Partial<Record<Role, string>>
    )[role] ?? 'home'
  );
}

export function portalLinks(role: Role): WorkspaceLink[] {
  const core: WorkspaceLink[] =
    role === 'parent'
      ? [
          ['learning-home', 'Home'],
          ['learning-attendance', 'Attendance'],
          ['learning-academics', 'Academics'],
          ['learning-homework', 'Homework'],
        ]
      : role === 'teacher'
        ? [
            ['teacher-day', 'My Day'],
            ['teacher-timetable', 'Timetable'],
            ['teacher-students', 'Students'],
            ['teacher-marks', 'Marks Entry'],
            ['home', 'School tasks'],
          ]
        : role === 'principal'
          ? [
              ['principal-overview', 'School dashboard'],
              ['principal-performance', 'Performance'],
              ['principal-staff', 'Staff'],
              ['teacher-students', 'Student profiles'],
              ['home', 'Staff tasks'],
            ]
          : role === 'librarian'
            ? [
                ['library-home', 'Library home'],
                ['library-catalogue', 'Catalogue'],
                ['library-loans', 'Issue & returns'],
                ['library-overdue', 'Overdue'],
                ['library-history', 'Borrowing history'],
                ['home', 'Library tasks'],
              ]
            : role === 'support'
              ? [
                  ['maintenance-home', 'School care'],
                  ['maintenance-work', 'My maintenance work'],
                  ['maintenance-reported', 'Reported issues'],
                  ['maintenance-history', 'Work history'],
                  ['operations-inventory', 'Inventory'],
                  ['home', 'General staff tasks'],
                ]
              : [
                  [
                    'home',
                    role === 'clerk'
                      ? 'Office work'
                      : role === 'accountant'
                        ? 'Accounts work'
                        : 'School team',
                  ],
                ];
  if (!['support', 'parent', 'administrator'].includes(role))
    core.push([
      'maintenance-home',
      role === 'principal'
        ? 'Facilities & maintenance'
        : 'Report facility issue',
    ]);
  if (['principal', 'parent'].includes(role))
    core.push([
      'library-home',
      role === 'parent' ? 'Library' : 'School library',
    ]);
  if (['teacher', 'principal'].includes(role))
    core.push(['learning', 'Academics & homework']);
  if (role === 'principal')
    core.push(['teacher-timetable', 'Teaching timetable']);
  if (role !== 'administrator')
    core.push([
      'operations',
      role === 'principal'
        ? 'School administration'
        : role === 'parent'
          ? 'School calendar'
          : 'Staff services',
    ]);
  if (role === 'principal') core.push(['oversight', 'Officer coordination']);
  core.push(['requests', 'Requests & replies'], ['notices', 'School notices']);
  if (['principal', 'administrator', 'clerk'].includes(role))
    core.push(['directory', 'Learner directory']);
  return core;
}

export function portalLinkActive(
  view: string,
  id: string,
  role: Role,
): boolean {
  return (
    view === id ||
    (id === 'library-home' &&
      role !== 'librarian' &&
      view.startsWith('library-')) ||
    (id === 'maintenance-home' &&
      role !== 'support' &&
      view.startsWith('maintenance-')) ||
    (id === 'operations' &&
      view.startsWith('operations-') &&
      !(role === 'support' && view === 'operations-inventory'))
  );
}

export function oversightLinks(role: Role): WorkspaceLink[] {
  const core: WorkspaceLink[] =
    role === 'commissioner'
      ? [
          ['municipal', 'Municipal overview'],
          ['comparison', 'School comparison'],
          ['priorities', 'Municipal priorities'],
          ['escalations', 'Escalated decisions'],
          ['schools', 'School profiles'],
        ]
      : role === 'principal'
        ? []
        : [
            ['overview', 'Overview'],
            ['schools', 'School profiles'],
          ];
  if (role !== 'commissioner')
    core.push(['priorities', 'Municipal priorities']);
  core.push(
    ['inspection', 'Inspections'],
    ['request', 'School requests'],
    ['circular', 'Circulars & compliance'],
  );
  if (role !== 'principal') core.push(['resources', 'Grants & infrastructure']);
  return core;
}
