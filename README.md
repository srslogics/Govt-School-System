# Shiksha-Setu school operations pilot

React/TypeScript demonstration of a Nagpur school-administration command centre and six role workspaces. All schools, counts, contacts and governance routing shown here are illustrative and unverified. No government endorsement or live data connection is implied. Do not enter real student, family, personnel or financial information.

## Run the shared attendance workspace

On the Node host, the main URL opens the shared pilot at **`/erp`**. The original sample modules have a separate sign-in at **`/preview`**. Attendance, assignments, enrolments, credentials and session records use one server-side database. Render uses hosted Turso libSQL. Local development can use a SQLite file. All seeded names are fictional. The principal/officer assignments are configurable and do not represent a confirmed NMC hierarchy.

Use Node 22.13+ and run these commands from this repository:

```sh
npm ci --ignore-scripts --include=optional
export ERP_DB_PATH="$PWD/.erp-data/pilot.sqlite"
export ERP_ORIGIN="http://127.0.0.1:3000"
npm run seed:erp
npm run build:erp
npm run start:erp -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/erp`. Seed only once per empty database. The seed creates separate random passwords for the thirteen accounts and writes them to `.erp-data/pilot.sqlite.accounts.json` with owner-only permissions. Keep the file private and give each participant only their assigned account. For development, use `npm run dev:erp -- --host 127.0.0.1 --port 3000` with the same environment.

| Account        | Assignment                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `admin`        | Add schools, classes/sections, fictional enrolments and staff. Assign or remove class or school access. |
| `teacher.a`    | School A, Class 5 Section A                                                                             |
| `teacher.b`    | School B, Class 6 Section A                                                                             |
| `principal.a`  | School A, including both Class 5 sections                                                               |
| `principal.b`  | School B                                                                                                |
| `officer.a`    | School A oversight, inspections, requests, circulars and attendance drill-down                                                                  |
| `commissioner` | Municipal summaries across both schools and class coverage in school drill-down                         |

### Teacher to Commissioner walkthrough

1. Use today's date in Nagpur, or select the date the demo was seeded. Sign in as `teacher.a`. Mark two learners **Present** and one **On leave**, then submit Class 5 Section A.
2. In a separate browser profile, sign in as `principal.a`. Open **Attendance reports**, refresh if needed and open the submitted register. Class 5 Section B shows **not submitted**.
3. Sign in as `teacher.b` in another profile. School A's direct register link `/erp?class=class-a&date=YYYY-MM-DD` cannot reveal its roster. The register endpoint also rejects the School B session for both reads and writes. Submit five **Absent** marks for School B to show a reported 0% rate.
4. Sign in as `commissioner`. Select the same date. The total is **2 present out of 8 marks, or 25%**, and **2 of 3** expected registers are included. Select each school for class coverage. The Commissioner export contains only summaries.
5. Return School A's register from `principal.a` with a reason. It is excluded from the combined rate until resubmitted. Correct the last mark as `teacher.a`, add a correction note and resubmit. Mark it reviewed as `principal.a`. The history records actors, timestamps, notes and the number of changed marks. With three present marks in School A, the combined rate is **37.5%**.
6. As `officer.a`, check that the report and CSV contain School A only. To see an administrator change propagate, add a class and enrol a fictional learner, then assign a teacher. The teacher sees that class after reloading the workspace.

The daily coverage denominator counts classes with at least one enrolment effective on the selected date. Submitted and reviewed registers contribute to attendance. The rate uses present marks divided by present, absent and on-leave marks. Missing and returned registers remain visible in coverage. The submitted roster is saved with the register so subsequent enrolments do not rewrite it. This pilot uses a date selector and class enrolment dates. A school calendar and term rules are later scope.

### Hosting and checks

#### Render

Use a **Free Node web service on Render** and a **Turso Free libSQL database**. The database lives outside Render, so attendance and sessions survive restarts and redeploys. Render can spin down the service after 15 minutes of inactivity, so allow time for the first request before the walkthrough. [Render Free documentation](https://render.com/docs/free) · [Turso pricing](https://turso.tech/pricing)

1. Create an empty **libSQL** database in Turso. With the Turso CLI, use `turso db create shiksha-setu-pilot` without `--tursodb`. Get its URL with `turso db show shiksha-setu-pilot --url` and create a database token with `turso db tokens create shiksha-setu-pilot`. Keep the token private. [Turso quickstart](https://docs.turso.tech/quickstart)
2. In your local shell, export the URL as `TURSO_DATABASE_URL` and the token as `TURSO_AUTH_TOKEN`. From the repository, run `npm ci --ignore-scripts --include=optional` and then `npm run seed:erp` once. The generated sign-in credentials are written to the private file `.erp-data/hosted.accounts.json`. Use each account separately during the walkthrough. Seed only a new, empty database. If the database already contains pilot records, keep its original credentials and use that database as-is.
3. For a new service, import [render.yaml](render.yaml) as a Render Blueprint. For an existing Render **Web Service**, apply the following settings. Set both Turso variables in Render's environment settings and deploy. Visit `/erp`.

| Setting                   | Value                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| Runtime and instance type | Node, Free                                                                      |
| Node version              | Set `NODE_VERSION` to `>=22.13.0 <23`                                           |
| Build command             | `npm ci --ignore-scripts --include=dev --include=optional && npm run build:erp` |
| Start command             | `npm run start:erp -- --hostname 0.0.0.0`                                       |
| Environment variables     | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`                                        |
| Health check path         | `/erp`                                                                          |

The server listens on Render's assigned `PORT`. The default `onrender.com` URL works through Render's `RENDER_EXTERNAL_URL` variable. For a custom domain, set `ERP_ORIGIN` to its full HTTPS origin and use that domain for sign-in. On Render, the app requires the shared database variables even if `ERP_DB_PATH` is present. The Worker build serves the reference previews and returns 503 for the shared ERP API.

Run `npm test` for independent HTTP-session tests covering scoped URLs and edits, CSV, school setup, duplicate submission, review/correction history and database restart. The two build modes are checked with `npm run build` for the Worker previews and `npm run build:erp` for the shared Node pilot. They both use `dist`, so rebuild the intended target before starting it.

The original request approvals and six role workspaces remain previews. Later milestones include extended student records, staff and leave, timetables, assessments and report cards, parent access and school administration. The shared pilot uses fictional data only.

## Run the reference previews

Node 22.13+ and npm are required.

```sh
npm ci --ignore-scripts --include=optional
npm run dev
```

The dev command prints the local URL. `npm run build` emits `dist/client` and a Cloudflare Worker under `dist/server`. `npm start` runs the built worker locally through Wrangler. It is a preview command, not an internet-facing production hosting command. This project is not a static HTML export.

The Vite configuration uses Vinext, Cloudflare and the Sites packaging plugin. The existing `.openai/hosting.json` identifies its original Sites project; repository pushes alone do not prove that Site has deployed. A Cloudflare deployment needs that account's normal Wrangler deployment configuration. No Render deployment has been performed or verified in this change. Do not configure `dist/client` alone as a Render Static Site and expect server-rendered routes to work. Use the Render Node web service settings above for the shared ERP.

For sharing metadata, `SITE_URL` takes precedence over `RENDER_EXTERNAL_URL`; otherwise the original demo origin is retained. The public Open Graph image is `public/og.png`. Static administrative fixtures use 31 August 2026 as their sample data date. Saved workflow actions use their actual entry timestamps.

## Demo accounts

The shared public sample password is **Nagpur@2026**. This is a client-side demonstration gate, not real authentication.

| User ID          | Workspace / assignment                               |
| ---------------- | ---------------------------------------------------- |
| district.admin   | Executive / district view                            |
| commissioner     | Executive / district view                            |
| field.officer    | Field Officer / Hingna sample schools                |
| parseoni.officer | Field Officer / Parseoni sample school               |
| headmaster       | School Office / Parseoni                             |
| teacher          | Teacher / own Parseoni requests                      |
| parent           | Family & SMC / own Parseoni requests                 |
| mis.admin        | MIS / read district workflows and record MIS actions |

Use Sign out to change the demo profile. Application launchers no longer permit switching to another profile's app or claiming its role. Restoring a session uses the canonical account definition, discarding any supplied role/name/assignment fields. These checks improve the demo experience but do not protect data from someone controlling the browser.

## Complete connected workflow

1. Sign in as **headmaster**. Open **School workflows** on `/`, or the request workspace on `/apps`.
2. Create a school request: select Parseoni, choose a category, enter subject/details and **Save draft**.
3. **Open request**, add remarks, then **Submit request**. Its saved history now includes Draft and Submitted.
4. Sign out and sign in as **parseoni.officer**. The same request appears. Add remarks and **Record review**; it becomes Under review. `field.officer`, assigned to Hingna, cannot see it.
5. Sign in as **district.admin** or **commissioner**. Open the request, enter decision remarks and select Approved, Rejected or Returned. District profiles can first review a submitted request if direct district review is needed.
6. Return to **headmaster**. The updated decision/history is visible. After approval, add completion remarks and **Confirm completion** to close it.
7. Returned requests can be resubmitted by their originator with new remarks. Rejected/closed records have no further transitions. A profile cannot approve its own request.
8. Reload at any step: status, remarks and history persist in the same browser. Workflow counts and reports derive from saved records, not hardcoded snapshot metrics.

Categories include staffing, infrastructure, inspection, grant, student support and grievance requests. Routing is a proposed demo workflow and is not a verified delegation of governmental powers.

## Existing reference modules and application tabs

The 13 original district modules are retained with sample administrative registers. Generic detail actions now require remarks and append a saved local status/history; register rows show the saved demo action separately from the original fixture status. These generic actions do not create official approvals, validate real source systems, upload evidence or update external records.

The six `/apps` workspaces retain reference snapshots clearly labelled as fixed sample figures. Task completion/remarks persist in the shared local action log. Primary tabs include the connected request desk; other tabs show assigned schools, request filters/drafts, saved activity, reports or the current access assignment rather than repeating the same static grid. Exact school-specific workflows and jurisdiction policies still need client validation. All profiles and pages use the same record store.

The map is explicitly a base map and a review-category selector, not a GIS risk overlay. The language button identifies its scope as office-heading language; full Marathi UI translation is not implemented. Notifications and integration snapshots remain sample content.

## Persistence and recovery

- `shikshan-setu-demo-session`: canonical demo account selection; no private token or company password.
- `shikshan-setu-records-v1`: validated versioned requests and module actions, independent of sign-in/out.
- Blocked storage allows a temporary in-memory session and record entry with a visible warning.
- Malformed record text is preserved; edits are blocked until explicit recovery/reset. Download recovery data before replacing anything.
- Recovery exports respect the active demo view; only Executive/MIS can include the original damaged stored text or reset all demo records.
- Other-tab updates refresh records. Optimistic pre-save checks reject conflicting writes detected before save. This is not database-level atomic concurrency control.
- Recovery JSON export is provided. There is no import/restore UI yet; actual restore procedures belong to production work.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run audit
```

Tests exercise the full request lifecycle, returns/resubmission, profile and school scoping, remarks persistence, malformed records, canonical sessions and blocked storage. UI tests run in Node with Happy DOM; no browser is opened. Keyboard-accessible register rows and dialog focus trapping, Escape close and focus return are implemented. Real browser, mobile layout, screen-reader and deployment verification remain outstanding under the user's no-browser instruction.

GitHub Actions runs install, application-code lint, TypeScript, tests, build and dependency audit on pushes/PRs. Dependency versions are pinned. `fast-uri` and `fflate` overrides select compatible patched releases for inherited dependencies; re-evaluate them on future upgrades. The vendored shadcn Tailwind variants preserve existing component styling without shipping its unused CLI/tooling dependency; its MIT license is in `app/vendor/SHADCN-LICENSE`.

## Reference preview boundaries

The original routes at `/` and `/apps` remain browser-local previews. Production requires server-backed authentication, authorized jurisdiction/role checks, a transactional shared database, protected child/personnel data, audit retention, secure file handling, tested backup restoration, monitoring and approved integrations. Browser roles, local history and storage are editable by the browser owner. No real approval, statutory filing, offline synchronization or government integration is performed.

The retained generated UI component catalogue (`components/ui`) and its unused generated mobile hook are outside the application lint scope; their legacy patterns have not been comprehensively audited. Active application components, workflow logic and tests are linted and typechecked. Original large reference pages remain in place; the new authentication definitions, permissions, workflow model, persistence, dialogs and request UI are extracted into separate modules.

Validated for this update: application-code lint, TypeScript, 9 workflow/UI regression tests, production build and `npm audit` (zero known findings at verification time). A local built-Worker HTTP smoke check returned 200 for both `/` and `/apps`. No browser was opened and no hosting deployment was performed. Vinext emits upstream sourcemap/route-classification warnings; these did not prevent the build or local HTTP checks.

## Role-led daily experience

Every profile now starts on **My work** on both routes. The everyday navigation is **My work, Requests, History**. Each role has its own wording, primary action and live attention queue, derived from saved request status and permitted transitions. Open and waiting counts lead to matching filtered queues. Clicking an attention item opens that request directly, without another search.

All authorized district registers remain under **More tools & registers**. All six applications and all their existing tabs, quick actions and reference snapshots remain available; specialist role tools are under **More tools** in the role workspace. Reference snapshots are no longer the default home screen. The existing root/apps routes are retained, and navigation between them uses client routing to preserve temporary in-memory sessions when storage is blocked.

Login offers six concise demo-role choices. The original eight profiles, including Commissioner and Parseoni Field Officer, remain under **Specific office/profile**. Manual ID/password entry remains under **Demo sign-in details**. Saved accounts, request records and workflow permissions have not changed. This is presentation convenience, not a production auto-login design.

The expanded 12-test suite verifies the role homes for all eight profiles, every authorized advanced-register entry, direct attention-to-review interaction, live queue updates and parent grievance defaults, in addition to the original persistence and approval tests. Real browser/mobile visual verification remains outstanding under the user's no-browser instruction.

## Parent and school staff workspaces

The shared Node ERP now includes Parent / guardian, School office / clerk, Accounts staff, Librarian and Support staff alongside the existing roles. The sign-in screen lists all ten workspaces; selecting a workspace only fills its sample username and still requires its assigned password.

New empty-database seeds create `parent.a`, `parent.b`, `office.a`, `accounts.a`, `library.a`, and `support.a` in addition to the original accounts. Passwords remain individually random and are saved in the private accounts file. Never reseed an existing database to add users: use administrator account creation instead.

- Parents see only the attendance of explicitly linked enrolments, school notices addressed to parents, and their own requests/replies. Missing and returned registers show no attendance mark. A school request never changes attendance.
- The school office can view its assigned-school learner directory, its own work, and handle school requests.
- Accounts staff, librarians and support staff see their assigned tasks and their department's requests. Their workspaces do not implement payments, accounting ledgers, payroll, book circulation or personnel leave management.
- Principals assign work within their schools, publish notices for parents/staff/both, and handle school requests. Staff complete only their own assigned tasks with a note.
- Administrators create accounts and school assignments, and grant/revoke parent links in **Parent links**. Each child is linked separately. Revocation is checked on subsequent reads and writes.

Requests, responses, task completion, and notices are stored in the shared database. Mutations write an activity record; requests/tasks use version checks. The portal returns at most 100 requests/tasks, 50 notices and 200 directory learners per view. Pagination and larger district-scale workflows remain later work.

On Node startup, schema initialization atomically expands the original account-role constraint while preserving account IDs, password hashes, sessions and foreign-key references, then creates the portal tables. Take and verify a database backup before any production upgrade. Migration and permission tests cover local libSQL; a hosted Turso upgrade has not been exercised in this change. No live data is seeded or migrated by local testing.

### Public meeting demo sign-in

At `https://govt-school-system.onrender.com/erp`, the requested shared meeting password is **`Demo@2026`** for all thirteen fictional demo accounts. The sign-in chooser fills the account username; enter the shared password. This is a public fictional demonstration, not a private school deployment.

A one-time Node startup setup runs only when both the configured origin and Render's external URL match this exact demo host and `RENDER=true`. It also verifies the two original fictional schools, all existing account identities/roles, and the sample learner relationships before changing anything. It sets the demo account passwords and adds missing parent/staff accounts, linking only newly created accounts to the fictional fixtures. Existing assignments, parent links, school data, enrolments and attendance are retained. Existing sessions are invalidated once. A database marker prevents further automatic password resets on restarts. Other hosts and databases with non-fixture accounts are left unchanged. Normal account creation still requires a 12-character password.

## Parent learning: Home, Attendance, Academics and Homework

Parents now have four primary learning sections alongside school requests and notices. Home summarises the selected linked learner’s reported monthly attendance, latest published assessment, pending homework, teacher feedback and school notices. Attendance uses actual register snapshots through the selected date; missing days and returned registers are not treated as absences. No school-calendar or holiday rules are inferred.

Teachers use **My school workspace → Academics & homework** to enter individual subject marks and feedback for their assigned learners, assign homework to their classes, and respond to parent completion notes. Principals use **Team & families → Academics & homework** to publish results. Draft marks are hidden from parents. Published report cards group entered subjects by assessment name/date and explicitly identify partial subject totals. Subject progress compares published percentages; a single result is labelled as the first published result. This pilot does not issue official certificates, calculate statutory grades, or provide editable published marks.

Parents report homework completion with a note; this does not upload attachments or assert teacher verification. Teacher feedback is stored separately. Updates check current role, class/child scope and versions inside transactions, and append school activity records. The learning API limits each view to 500 assessment/submission records and 100 homework records; pagination remains future work.

Schema initialization adds assessment, homework and submission tables. A one-time fictional sample setup recognises only the two exact demo schools, sample learners and teacher identities. It adds labelled sample results and homework for the first learner in each school, preserves existing attendance, and records an activity marker. It does not generate attendance or overwrite entered records. These examples are not real student performance.

Validation adds API permission/lifecycle tests, sample-setup tests, and a Happy DOM interaction test for all four parent sections, persisted homework completion and principal publication. Real-browser visual verification was unavailable because local browser use was disabled in Work settings for this change.

## Teacher daily workspace

Teacher accounts now start on **My Day** (direct register links still open the requested class). It shows recurring periods for the selected weekday, effective class attendance status, unpublished subject-result counts and homework completion reports awaiting feedback. **Timetable** shows the teacher’s own weekly periods. Principals add periods from **School dashboard → Teaching timetable**; the server rejects teacher/class overlaps and assignments outside the principal’s schools. Weekly timetables do not model holidays, substitutions or calendar exceptions.

**Students** provides searchable assigned-class profiles with reported monthly attendance, assessment history/feedback and homework completion. **Marks Entry** supports an atomic class grid of up to 200 populated rows, with individual feedback and current versions. Blank marks are skipped; zero is a valid mark. Matching subject/assessment/date loads existing drafts. Maximum marks applies to every saved row. Draft corrections retain before/after audit values; published results cannot be overwritten. Teachers can also edit individual drafts in **Academics & homework**, while principals retain publication controls. School tasks, notices, requests and homework remain available.

A one-time exact-fixture setup adds clearly labelled fictional weekday timetable examples for the two original sample teachers, skips conflicting existing periods and never resets a principal’s schedule. Tests cover timetable/class isolation, overlaps, bulk validation and rollback, draft corrections, stale writes, publication locks, revocation and teacher UI interactions. Real-browser visual QA remains unavailable under the current Work settings; builds and Happy DOM interaction checks are used instead.

### Principal school dashboard

Principals start in **School dashboard**, with a compact attendance summary and links to full attendance reports/register review. The dashboard combines existing school-scoped report, teaching and community APIs to show pending register reviews, missing/returned registers, draft results, open requests and staff work. **Performance** summarises published results by class (equal weight per result percentage across subjects/exams, up to 500 loaded records); **Staff** shows assigned accounts, teaching responsibilities and open tasks. Student profiles, result publication, timetable additions, requests, notices and task assignment remain available in the same workspace. The dashboard school selector filters its summaries, while destination sections continue to show all assigned schools. Task/request totals reflect the existing 100-record API limits; they are not all-time totals. Staff account lists do not establish staff presence or a full HR roster. The School administration modules below provide the first operational workflows. Examination events can be scheduled in the calendar; exam planning, hall allocation and formal report cards remain separate work.


### Saved school administration workflows

`GET/POST /api/erp/operations` uses a new `school_operation` table, created additively on startup. Records have a validated kind, school, immutable identity/reference key, controlled status, JSON payload, author and version. Every mutation appends before/after data to `school_activity` in the same transaction; authorized record history is exposed in the UI. Principals see their assigned schools; staff see their personal attendance/leave plus role-specific records. Parents see only calendar audiences `parents` or `all` in linked schools. No existing attendance, credentials or demo data is reset; these modules start empty.

- **Staff attendance:** principal records/corrects daily attendance with a note; staff can read their own marks. Unique staff/date per school, versioned corrections, no automatic marking from leave/calendar.
- **Leave:** any assigned staff member submits a date range and reason; principal approves/declines with a decision note. Pending/approved overlapping requests for that employee are rejected across schools; self-approval/decline is forbidden. A principal's own leave requires a different assigned principal. No leave balances, delegation, withdrawal or post-approval edits yet.
- **Admissions:** principal or clerk records an application with guardian contact and requested class. Principal admission atomically creates an enrolment with unique class/roll and valid effective date. Declines retain the application. Guardian sign-in/linking remains an administrator task; there is no document upload, transfer or duplicate-person matching.
- **Payroll:** principal/accountant prepares one salary record per employee, school and month. Money is stored and validated as integer paise; net is gross minus deductions. Draft/declined records can be revised with versions; principals approve/decline and approved records are locked. Approval is internal, not evidence of disbursement. No banking, statutory calculations, tax filings, payslip export or attendance-derived salary computation.
- **Grants:** principal/accountant records a sanctioned allocation/reference and voucher expenses. Every expense uses a transaction-protected complete balance; overdrafts, duplicate voucher references and expenses before sanction are rejected. Entries are management records, not a full double-entry ledger. No reconciliation, payment execution, attachments, expense approval/reversal or sanction amendments yet.
- **Inventory:** principal/library/support records unique item codes, units and opening quantities. Receive/return and issue movements retain purpose/recipient notes and author. Issues cannot exceed the complete current balance. No negative stock, valuation, depreciation, asset tags or historical daily stock reconstruction; movement dates are descriptive, not a backdated balance recalculation.
- **Calendar:** principals publish all-day holiday/exam/meeting/activity date ranges for parents, staff or both, and can cancel with a note. Future dates are supported here and in leave requests. Audience restrictions apply to data and history. No reminders, recurrence, event edits, substitutions or automatic attendance/timetable changes.

The principal dashboard includes pending leave, admissions and payroll counts and direct links. Staff find their workflows in **Staff services**; parents have **School calendar**. All changes require same-origin JSON, current school access and version checks for transitions/corrections. Grants and stock movements are append-only. Operations currently load the complete authorized school histories to keep balances accurate; server-side pagination and aggregate queries, retention, exports and measured load testing are required before claiming readiness for 100 schools. Automated API and Happy DOM tests exercise all seven flows, cross-role/school denial, stale writes, admission rollback, grant concurrency, currency precision and audit history.


### Education Officer oversight

Education officers now start in **School oversight**, with assigned-school attention queues, summary profiles, inspections, school requests, circular compliance, and grant/infrastructure indicators. Existing attendance reports and CSV exports remain available. Principals use **Officer coordination** in their school workspace; the Commissioner has **Municipal dashboard** in the sidebar. The initial officer fixture remains assigned to School A only; administrator school assignments control actual scope and do not imply an NMC hierarchy.

`GET/POST /api/erp/oversight` is limited to principals, officers and the Commissioner. The additive `education_record` table stores school-scoped inspection/request/circular records with versions, controlled transitions and author attribution. Every mutation writes remarks and before/after statuses to `school_activity` in the same transaction. No existing records or credentials are reset; new workflow lists start empty.

- **Inspections:** officer plans a visit, records actual visit/findings and a corrective-action deadline; principal submits an action report; officer closes or returns for more action. Actual visit dates cannot be in the future.
- **School requests:** principal submits general/staffing/academic/funding/maintenance requests; officer records review then resolves, declines, returns or escalates. Returned requests can be resubmitted. Only the Commissioner can decide an escalated request. Outcomes are coordination dispositions, not financial sanction or payment authority.
- **Circulars:** officer issues an instruction/deadline to one or up to 100 assigned schools in one transaction. Each recipient has its own acknowledgement, compliance report and verification status. Principal acknowledges then reports; officer verifies/closes or returns for further details. Recipient scope is revalidated inside the transaction, so a mixed unauthorized broadcast rolls back entirely.
- **School profiles:** effective enrolment/classes, assigned staff/teacher account counts, attendance coverage and published assessment aggregates through the selected date. Academic percentages give equal weight to each result across exams/subjects and are not school rankings. No pupil names, individual marks, guardian contacts, leave reasons or payroll records are transferred to officers.
- **Resources:** recorded sanctioned grants, expenses and remaining allocation through the selected date, plus current inventory type/zero-stock counts and maintenance request counts. Inventory has no minimum-stock thresholds, bank reconciliation or audited utilisation certificates. Staff account counts are not sanctioned positions or vacancy calculations.

School/date academic and grant aggregation uses grouped database queries across the scope rather than a request per school; new supporting indexes cover school/class assignments, inventory references and record activity. Workflow lists/history and stock indicators show the current state even when an earlier reporting date is selected. There is no visit rescheduling/cancellation, attachments, reminders, recurring circulars, authenticated external delivery, formal sanction workflow, or server-side pagination yet. Complete authorized workflow histories are currently loaded; retained-history pagination, indexes verified against production query plans, real-browser layout checks and measured 100-school load tests remain necessary before production readiness can be claimed.

API tests cover isolation, role restrictions, revocation, stale writes, returned/resubmitted actions, Commissioner-only escalation decisions, broadcast atomicity, attendance aggregation and payroll/pupil-data privacy. Happy DOM interaction tests exercise principal/officer/Commissioner inspection, request and circular handoffs. Both deployment builds are checked.


### Commissioner municipal workspace

The Commissioner now starts in **Municipal dashboard**, with weighted attendance/coverage, enrolment, published academic indicators, grant totals, escalated decisions and municipal follow-up queues. **School comparison** sorts schools by coverage, reported attendance, recorded academic averages or zero-stock types, with denominators and assessment coverage displayed; it is not a school ranking. The summary CSV exports all schools in municipal scope, with school-level aggregates only, integer-paise finance columns, explicit current-state workflow fields and spreadsheet formula protection. The CSV is restricted to the Commissioner. Existing inspection, circular, school-profile and resource views remain available. **Escalated decisions** is a focused queue using the existing Commissioner-only escalation transition.

The additive `municipal_priority` table supports per-school assignments to education officers, categories, urgency, deadlines and versioned states: assigned → in-progress/reported → closed or returned to in-progress. Only the Commissioner assigns/reassigns/verifies; only the current assigned officer reports progress. An assigned officer must hold a current school assignment. Every action records remarks and before/after ownership/status in `school_activity` in the same transaction. Reassignment removes the former officer's access to both record and history, and school revocation takes effect on reads and writes. Principals have read-only visibility for their assigned schools; parents/staff have no access. New priorities start empty and do not change credentials, enrolments, attendance or existing oversight records.

Municipal priority state, staffing accounts, escalations and stock signals are current; attendance/enrolment/academic/grant summaries use the selected reporting date. Officer completion requires explicit Commissioner verification. Priorities do not execute payments or alter school registers. There is no priority cancellation, deadline amendment, attachments, automatic reminders, sanctioned-vacancy data, multi-period trend analysis or pagination yet. Supporting all 100 assigned schools in a circular is a functional limit, not a measured production-capacity guarantee; 100-school load testing and retention/pagination work remain outstanding.

Tests cover correct-owner reporting, self-verification denial, stale writes, reassignments, revocation, principal read-only visibility, audit history and safe role-restricted CSVs. Interaction tests cover the municipal overview/comparison, priority creation, officer completion, return for more work, final verification and focused escalated decisions.

### Librarian catalogue and circulation

`library.a` now starts on **Library home**, with catalogue, issue/return, overdue and borrowing-history sections. Principals have **School library** in their workspace. Parents have **Library**, showing only loans for their guardian-linked children in the selected school. Existing library tasks, resource requests, staff services and general inventory remain available. The library register is separate from general school inventory; existing stock records are not automatically converted to accessioned book copies.

The additive `library_book`, `library_copy` and `library_loan` tables store school-specific catalogue codes, physical accession numbers and student loans. Catalogue and accession identifiers are unique within each school, case-insensitively. Composite foreign keys keep a copy in its catalogue’s school. A partial unique index permits only one open loan per copy. All changes recheck current school/role access within a transaction; catalogue corrections, copy state changes, renewals and returns check versions. `school_activity` retains before/after records and required action notes. New library lists start empty and preserve all existing school records and credentials.

- Add a catalogue title (author, category, language, optional ISBN and shelf), then add each physical copy with its accession number and acquisition note. Catalogue details can be corrected with a reason; copies retain history and can be withdrawn/restored.
- Issue an available active copy to a learner whose class/enrolment is effective on the issue date. Issue dates cannot be future-dated or precede the copy’s previous loan closure; due dates cannot precede issue dates. No automated per-student loan limit is imposed.
- Overdue means an open loan whose due date is before today in Nagpur. Renewals must extend the existing due date and reach today or later. Renewals retain an audit note and version.
- Close a loan as returned, damaged or lost. Closure cannot precede issue or be in the future. Returned copies become available; damaged/lost copies require a later explicit check/repair/recovery state change before reissue. Borrowed copies cannot be withdrawn or otherwise bypass circulation through a stock edit. There are no automatic fines or payments.
- Borrowing history can be searched by student/class/title/accession and filtered by borrower. It includes every open loan and up to 200 recent closed loans per selected school (per linked family for parents); full-history counts and availability are not truncated. Only the librarian/principal can search the borrower directory, which returns up to 50 effective learners per search. Parent responses exclude the school catalogue, copy inventory, borrower directory and internal activity log; notes on their own loans are shared with families.

Library records show current circulation regardless of the attendance reporting date. Catalogue/copy data and manager activity history currently load the complete selected-school data sets; bulk imports, server-side catalogue/history pagination, barcode scanning, reservations, automatic reminders, fines, downloadable borrowing reports and broader borrowing policies remain future work. Lost/damaged outcomes close the loan administratively; they do not claim that a lost copy was physically returned. Real-browser layout checks and measured 100-school capacity testing remain outstanding.

API tests cover concurrent issue rejection, duplicate identifiers, effective dates, school/child isolation, guardian/staff revocation, renewal and return versions, damage/loss recovery, persisted history and database integrity. Happy DOM tests cover catalogue/copy creation, issuing an overdue book, family visibility, renewal, damaged return, repair and borrowing history.

### Support staff and school maintenance

`support.a` now starts in **School care**, with assigned maintenance work, reported issues, work history and a direct Inventory shortcut. Existing general staff tasks, requests, notices, inventory and staff leave/calendar services remain available. Principals use **Facilities & maintenance** and see pending maintenance completion reports on their dashboard. Teachers, office/accounts/library staff can use **Report facility issue** to raise and track their own tickets. Parents continue to contact the school through existing requests; they do not receive internal maintenance records.

The additive `maintenance_ticket` table stores category, location, urgency, reporter, responsible support worker, deadline, current status, progress/verification remarks and an optional linked education-office request. All mutations recheck role/school scope and versions inside a transaction; history retains actor remarks and before/after status, owner and deadline. The new register starts empty and leaves all existing tasks, inventory, attendance and credentials intact.

- School staff raise cleaning/water/electrical/furniture/grounds/safety/general issues. New tickets await principal assignment. Reporter visibility is limited to their own issues; support staff can additionally see their assigned tickets; principals see their assigned schools.
- Principals assign/reassign work to support accounts currently assigned to that school, with urgency, deadline and instructions. Staff cannot self-assign or update another worker's assignment. Reassignment removes the former worker's access unless they remain the original reporter.
- Assigned support staff report in-progress, blocked/assistance-needed or work-completed states with remarks. Reported completion awaits principal verification. Principals verify/close or return for more action; a staff report alone never closes the ticket.
- Principals can cancel duplicate/unneeded tickets or reopen closed/cancelled work with a reason. Reopening clears the old owner/deadline/progress and requires a new assignment; prior work remains in the audit history.
- A principal can escalate a nonterminal ticket to the Education Officer. This atomically creates one linked maintenance school request and its oversight history; duplicate escalation is rejected. The existing officer review/return/escalation/decision flow applies. The support register shows the linked office-request status. Resolving that request does not automatically close or verify the maintenance job.

School-care counts reflect reported tickets, not a completed safety inspection, sanctioned workload or daily readiness checklist. Deadlines and maintenance state are current regardless of the selected attendance reporting date. General `staff_task` completion remains its separate existing workflow; it is not retroactively converted into a verified maintenance ticket. There are no recurring checklists, uploads, contractor accounts, cost approvals, reminders, automatic inventory consumption, offline work or external emergency dispatch. Ticket/history pagination and measured 100-school load testing remain outstanding. Full authorized histories are currently loaded.

API tests cover reporter/assignee/principal permissions, reassignment, stale versions, blocked/report/return/verified closure, reopening/cancellation, staff and school revocation, persistence, audit history and one-time transactional education-office escalation. Happy DOM checks exercise teacher reporting, principal assignment, support blocking/completion, office escalation, returned work, the principal dashboard verification queue, closure/history and the inventory shortcut. Real-browser layout checks remain unavailable in this session.
