# Shikshan Setu — school administration demo

React/TypeScript demonstration of a Nagpur school-administration command centre and six role workspaces. All schools, counts, contacts and governance routing shown here are illustrative and unverified. No government endorsement or live data connection is implied. Do not enter real student, family, personnel or financial information.

## Run

Node 22.13+ and npm are required.

```sh
npm ci --ignore-scripts --include=optional
npm run dev
```

The dev command prints the local URL. `npm run build` emits `dist/client` and a Cloudflare Worker under `dist/server`. `npm start` runs the built worker locally through Wrangler. It is a preview command, not an internet-facing production hosting command. This project is not a static HTML export.

The Vite configuration uses Vinext, Cloudflare and the Sites packaging plugin. The existing `.openai/hosting.json` identifies its original Sites project; repository pushes alone do not prove that Site has deployed. A Cloudflare deployment needs that account's normal Wrangler deployment configuration. No Render deployment has been performed or verified in this change. Do not configure `dist/client` alone as a Render Static Site and expect server-rendered routes to work. Choose a supported Node deployment strategy or static-export conversion separately before deploying to Render.

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

## Production boundaries

This remains a browser-local demo. Production requires server-backed authentication, authorized jurisdiction/role checks, a transactional shared database, protected child/personnel data, audit retention, secure file handling, tested backup restoration, monitoring and approved integrations. Browser roles, local history and storage are editable by the browser owner. No real approval, statutory filing, offline synchronization or government integration is performed.

The retained generated UI component catalogue (`components/ui`) and its unused generated mobile hook are outside the application lint scope; their legacy patterns have not been comprehensively audited. Active application components, workflow logic and tests are linted and typechecked. Original large reference pages remain in place; the new authentication definitions, permissions, workflow model, persistence, dialogs and request UI are extracted into separate modules.

Validated for this update: application-code lint, TypeScript, 9 workflow/UI regression tests, production build and `npm audit` (zero known findings at verification time). A local built-Worker HTTP smoke check returned 200 for both `/` and `/apps`. No browser was opened and no hosting deployment was performed. Vinext emits upstream sourcemap/route-classification warnings; these did not prevent the build or local HTTP checks.
