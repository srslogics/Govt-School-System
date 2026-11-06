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

Open `http://127.0.0.1:3000/erp`. Seed only once per empty database. The seed creates separate random passwords for the seven accounts and writes them to `.erp-data/pilot.sqlite.accounts.json` with owner-only permissions. Keep the file private and give each participant only their assigned account. For development, use `npm run dev:erp -- --host 127.0.0.1 --port 3000` with the same environment.

| Account        | Assignment                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `admin`        | Add schools, classes/sections, fictional enrolments and staff. Assign or remove class or school access. |
| `teacher.a`    | School A, Class 5 Section A                                                                             |
| `teacher.b`    | School B, Class 6 Section A                                                                             |
| `principal.a`  | School A, including both Class 5 sections                                                               |
| `principal.b`  | School B                                                                                                |
| `officer.a`    | School A summary and school drill-down                                                                  |
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
