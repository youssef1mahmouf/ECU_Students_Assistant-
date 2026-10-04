# GA6 – ECU Students Assessment Portal

A small portal for the ECU "GA6" assessment: a public landing page, a student area scoped to
one group, and an administrator area for groups, content, accounts, activity and site info.

- **Frontend:** static HTML + CSS + ES modules (`frontend/`) – no framework, no build step.
- **Backend:** Express API (`backend/src/`) with server-side sessions, CSRF, rate limiting.
- **Data:** MongoDB Atlas when credentials exist, otherwise a local JSON file store.

## The frontend (2026 redesign)

One design system, one application shell, one way to express each of the four states a
data-driven area can be in. It is documented here because it is not obvious from a file
listing.

### One design system, no colours outside the token file

| File | Owns |
| --- | --- |
| `shared/tokens.css` | **every** colour, space, radius, shadow, type size, duration and layer index |
| `shared/base.css` | reset, document rhythm, focus, a11y utilities, layout helpers |
| `shared/components.css` | buttons, cards, tiles, forms, tables, states, toasts, dialogs |
| `shared/shell.css` | the app frame: topbar, sidebar, page column, footer |
| `shared/library.css` | the resource explorer and the viewer, nothing else |

The palette is "Meridian": a deep violet primary with an ember accent, written for this
project rather than inherited from a template. Both modes were measured against WCAG AA
(4.5:1 body text, 3:1 for large text and UI borders); the measured ratio is recorded
beside each token.

`npm run check` runs `frontend/csscheck.mjs`, which fails the build if a component
stylesheet hard-codes a colour. That is what makes the theme switch one attribute on
`<html>` instead of a partly-maintained override - and it is what caught the dark palette
being silently swallowed by an unclosed brace during this work.

### The shell

`shared/shell.js` draws the header, the sidebar and the footer for **all three areas**.
The contract with a page is three empty regions:

```html
<header class="topbar" id="appHeader"></header>
<aside   class="sidebar" id="appSidebar"></aside>   <!-- optional -->
<footer  class="footer"  id="appFooter"></footer>
```

Everything else on a page is written by that page's own view module, so no UI exists
without an understandable source. The route table lives in exactly one place,
`shared/nav.js`, and `backend/src/app.js` mirrors its `cap` fields in its page guards.

### Four states, one component

`shared/ui/view.js` turns a promise into pixels and supports exactly four states:
loading (a skeleton that deliberately does **not** look like content), empty, error
(with a Retry that re-runs the loader), and success. Every list, table, tile grid and
stat row goes through it, which is what removed the "loading card that looked like a
resource card" problem. A view also repaints itself on a language switch.

### One library, one source

| Route | Endpoint | Shows |
| --- | --- | --- |
| `/user/library/` | `GET /api/public/material-library` | the shared teaching-material index |
| `/user/documents/` | `GET /api/documents` | files uploaded to the caller's own group |
| `/user/viewer/` | either of the above | one file, inside the application |

These used to share a page, drawn by two modules over two data sets, which produced the
duplicate library cards. They are now three pages with three single-purpose renderers,
and `npm run verify:browser` asserts that the documents page contains no folder tree.

The open folder is the `?p=` query parameter and every folder is a real link, so a
folder can be bookmarked and the browser Back button walks the trail.

### Notifications

The backend has no notifications table and none was invented. Every item is derived
from an endpoint the reader could call directly: the recorded activity log for staff,
the caller's own published content for a student. Read state is a single ISO timestamp in
`localStorage`; no token, role or account data is stored, and marking something read
reveals nothing the reader could not already open.

### Libraries

| Library | Why | Why not something else |
| --- | --- | --- |
| `lucide-static` (ISC) | icons, inline so a glyph costs no request and inherits `currentColor` | sprite `<use>` has cross-browser quirks; hand-drawn icons would drift |
| `pdfjs-dist` (Apache-2.0) | in-app PDF rendering on the viewer route, fetched on demand | the native PDF plugin opens a viewer the app cannot style |

Deliberately **not** added:

- **A charting library.** The dashboard draws three bar series of at most fourteen bars
  from numbers the server already computed. `shared/ui/chart.js` is ~40 lines and matches
  the token system exactly; Chart.js would add ~200 KB to every admin page load to draw
  the same rectangles with different defaults.
- **A date library.** `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` are built in,
  localised, and smaller than any package.
- **A virtual list.** The largest index is a few hundred rows; pagination is enough.
- **A toast library.** A polite live region plus four components is less code and no
  dependency.
- **A framework.** The architecture is native ES modules; a framework would have meant a
  migration and a bundler.

Both libraries are **vendored into `frontend/shared/vendor/` by `npm run vendor`** and
committed. The server sends `default-src 'self'; script-src 'self'`, so a CDN `<script>`
would be blocked; committing the vendored output also means the application still runs on a
machine that never ran the frontend build at all. Dependencies themselves are installed
once, from the repository root - see **Dependency ownership** below.

### Appearance

Light, dark and "match the system", plus a compact density and a reduced-motion switch.
The choice is one JSON value in `localStorage` under `ecu.appearance` - a display
preference, never a secret. `shared/theme-boot.js` is the only classic (non-module)
script and the only reason there is no white flash on navigation in dark mode.

### Accessibility

- Semantic landmarks, one `<h1>` per page, a real `<form>` element per step.
- One focus treatment everywhere; `:focus-visible` keeps it off mouse clicks.
- A skip link, a keyboard-reachable drawer, Escape closes every menu and dialog.
- Status is never carried by colour alone: badges have labels, an unread row has a bar
  **and** the word "unread", and every button names its intent.
- `prefers-reduced-motion` and an explicit reduced-motion setting are both honoured, from
  the token file so no component can forget.
- Tables become labelled row stacks under 860px, keeping each header cell as a data
  label.

---
## Dependency ownership

The repository is a **single npm workspace rooted at the repository root**:

| Package | Manifest | Owns |
| --- | --- | --- |
| server + frontend | `package.json` (root) | express, mongodb, mongoose, dotenv, cors, puppeteer-core |
| frontend | `frontend/package.json` (workspace) | lucide-static, pdfjs-dist |

`npm ci` at the root installs both from **one** `package-lock.json`. There is deliberately
no `frontend/package-lock.json`: a second lockfile is what previously let `pdfjs-dist`
drift out of the lockfile and break a clean install.

- Do **not** run `npm install` inside `frontend/`. It is not required, and it is the one
  thing that hides a broken install.
- `frontend/prepare.mjs` resolves `lucide-static` and `pdfjs-dist` by walking up to the
  nearest `node_modules`, so it works whether npm hoists them to the root or keeps them
  nested. It only validates; it never installs.
- `backend/package.json` is a stale duplicate of the root manifest. Nothing reads it and
  `npm ci` ignores it, but it can be deleted.

---

## Quick start

Requires **Node 20 or newer**. The server alone runs on 18.17+, but the frontend build needs
20+ because of `pdfjs-dist`. `backend/` is not a separate npm project - see
**Dependency ownership** below.

```bash
npm ci                                   # one lockfile: server AND frontend dependencies
copy backend\.env.example backend\.env   # then edit it
$env:DATA_STORE = "file"                 # PowerShell - Linux/macOS: export DATA_STORE=file
npm run dev                              # local JSON store, http://127.0.0.1:3000
npm run seed:demo                        # optional: two groups + demo accounts
```

With Atlas credentials filled in `backend/.env`, use `npm start` (or `npm run seed` once to
create the first super admin, then `npm start`).

| URL | Who sees it |
| --- | --- |
| `/` | public landing page (assessment overview + group names) and the **Admin** link |
| `/?preview=visitor` | the same public page rendered as a visitor receives it (no impersonation, no permission bypass) |
| `/user/` | student sign-in (email first), first password, group request, group content, profile |
| `/user/report/` | "Report a problem" form (stored, visible to admins at `/admin/problems/`) |
| `/admin/` | staff sign-in gateway |
| `/admin/dashboard/` | account totals, per-role counts, online users and the daily / weekly / monthly activity charts |
| `/admin/accounts/` | accounts, approvals, group assignment, password reset, role assignment |
| `/admin/groups/` | group **cards** (name, description, notes, subjects) plus group content (create / publish / delete) |
| `/admin/activity/` | recorded events with staff/student + person filters and a Details dialog |
| `/admin/problems/` | problem reports submitted by users (reporter, time, page, category, description, status) |
| `/admin/information/` | title, tagline and about text shown on the public page |
| `/admin/profile/` | own name, roster identity (read-only) and own password |
| `/admin/library/` | the shared material index, for staff (same explorer as the student page) |
| `/admin/notifications/` | system and security events, most severe first |
| `/admin/security/` | sign-in and security events only |
| `/admin/health/` | `GET /api/health`, exactly as the server reports it |
| `/admin/settings/` | display preferences, shared with the student settings page |
| `/user/library/` | the shared teaching-material index: subjects, weeks, sessions, files |
| `/user/viewer/` | one PDF, image, video, audio or text file, inside the application |
| `/user/notifications/` | what was published to the caller's own group |
| `/user/settings/` | theme, density, motion and language |

### Data store

`DATA_STORE` picks the store. Left empty, Atlas is used when its credentials are present
and the local JSON file otherwise.

| Value | Store |
| --- | --- |
| *(unset)* | Atlas if credentials exist, otherwise the file store |
| `file`, `json`, `local`, `none` | `backend/data_base/db.json` |
| `mongo` | MongoDB Atlas |

An unrecognised value is **reported**, not ignored - previously `DATA_STORE=json` was
silently treated as "unset", which selected Atlas and stopped the server dead with a raw
`SSL alert number 80` on any machine that could not reach the cluster.

When Atlas is configured but unreachable, a **development** server falls back to the file
store and says so, rather than refusing to start. Set `MONGO_FALLBACK_TO_FILE=false` to
fail instead. Production is always strict: silently writing to a different datastore there
would be worse than not starting at all.

## npm scripts

| Command | What it does |
| --- | --- |
| `npm start` | start the server (`backend/server.js`) |
| `npm run dev` | start with auto-restart (set `DATA_STORE=file` to force the local JSON store) |
| `npm run test:db` | Atlas reachability probe; result written to `test-conn.log` |
| `npm run check` | syntax-check every backend file |
| `npm run verify` | **117 permission, security and multi-group checks** against an isolated temp store |
| `npm run verify:pages` | **117 checks** that every page/asset is served and capability-guarded |
| `npm run verify:browser` | **472 checks** driving the real Chrome/Edge over every page, in light and dark, at desktop and phone widths |
| `npm run verify:all` | all of the above, in order |
| `cd frontend && npm run check` | syntax, stylesheet integrity and the bilingual key audit |
| `cd frontend && npm run build` | vendors the two libraries, validates every page reference, emits `dist/` |

Deployment (Cloudflare Pages) is exactly `npm ci` at the repository root, then
`cd frontend && npm run build`. Nothing else is required, and nothing may be installed
inside `frontend/`.
| `node backend/scripts/i18n-audit.js` | bilingual audit of every key, reference and page |
| `npm run extract:roster -- <pdf…>` | read the group PDFs into `backend/data_base/roster.<name>.json` + review report |
| `npm run import:roster` | import that roster document (`--dry-run`, `--store=file`, `--json=<path>`) |
| `npm run verify:roster` | **21 checks** that every printed student, group and TA arrived and that re-importing is safe |
| `npm run verify:documents` | **66 checks** on the subject/document routes, including multi-group uploads and downloads |
| `npm run seed` | create the first super admin (needs `ADMIN_BOOTSTRAP_EMAIL` in `.env`) |
| `npm run seed:mongo` | same against Atlas, plus Group 1/Group 2 |
| `npm run seed:demo` | `--with-demo`: local store + Group 1/Group 2 and demo students |
| `npm run bootstrap:owner` | create or raise the owner account, gated by the roster (`--check`, `--store=`, `--password-file=`) |

`verify` and `verify:pages` always run on a throwaway store in the OS temp folder and delete it
afterwards; they never read or write your real data and never print credentials.

## Roles

`backend/src/lib/permissions.js` is the single source of truth: each role holds an explicit
capability list, the API enforces it through `requireCap(...)`, and the browser only receives
that same list so it can hide what the server would refuse.

| Role | Capabilities |
| --- | --- |
| `user` | student: own profile, own group's published content and documents after approval |
| `adminAssistant` | admin area read-only (dashboard, groups, content, documents, activity), **plus** problem-report triage |
| `doctor`, `engineer` | admin area read-only (dashboard, groups, content, documents, activity) |
| `admin` | everything above plus groups, content, subjects, documents, student accounts and site information |
| `superAdminAssistant` | exactly the `admin` capabilities - **never** role assignment or staff-account management |
| `superAdmin` | all capabilities, including role assignment and staff management |

Rules that hold for every role:

* any role other than `user` is **privileged**, and only a super admin may create or assign one;
* a **Super Admin Assistant is not a silent super admin**: `isSuperAdmin` is false, `rolesAssign`
  and `accountsStaff` are absent, so role changes and staff deletes are refused with 403;
* the **protected owner account** (`PROTECTED_OWNER_EMAIL`, default `192600250@ecu.edu.eg`) cannot be
  disabled, password-reset, re-roled, moved between groups or deleted through the admin API - the
  accounts screen shows no Password/Disable/Delete buttons for it, and the server refuses them anyway;
* page guards follow the same matrix (`requirePageCapability`), so a role never even receives the
  markup of a page it may not use.

Every role can always edit its own display name and its own password; roster identity, group,
email and role never come from browser input.

## How access is enforced

The API is the only authority. Every read takes the acting user's group from the stored account,
never from the query string, and the student/user endpoints ask the store for
`publishedOnly: true` records, so drafts never reach a student. Page guards in
`backend/src/app.js` resolve the session for the protected documents (`/admin/...`, `/user/...`)
and answer `303` (redirect) for anonymous visitors and `403` for a signed-in visitor without the
capability — the page markup is never sent.

Group data stays private: `GET /api/user/groups` answers with the caller's own group only,
`/api/user/records` and `/api/documents` match the caller's group against **every** group a record
or document is assigned to, and the full catalogue (notes, subject associations, member and
content counts) stays behind the admin API, which answers `403` to anyone without the matching
capability. The public endpoints return the deliberately public projection only: group **name and
description**, and published assessment information — no notes, subjects, members or counts.

Content and documents are stored with a `groups` array plus the historical single `group` field,
so existing records keep working; `backend/src/db/store.js` migrates the legacy shape on every
boot (it only writes when something actually changes) and renaming a group moves its members,
content and documents with it.

## Dashboard numbers

All dashboard figures come from persisted data (`GET /api/admin/overview`):

| Figure | Definition |
| --- | --- |
| Total accounts | count of user rows in the store |
| Accounts by role | one count per role, admins = `admin` + `superAdmin` |
| Online now | distinct accounts with a session whose `lastSeenAt` falls inside the **online period** - configurable with `ONLINE_WINDOW_MINUTES` (default 15); sessions are touched at most once a minute |
| Daily chart | recorded events per calendar day over the last 14 days |
| Weekly chart | recorded events per ISO week (Monday–Sunday) over the last 8 weeks |
| Monthly chart | recorded events per calendar month over the last 12 months |
| Chart ranges | each bucket reports its own `from`/`to` range plus its count |

Buckets are counted from the real activity log in server local time; nothing is estimated.
"Recent Activity" was removed from the dashboard - the Activity Log page is the place for
detailed event review (staff/student filter, person filter, and a Details dialog showing who,
when, what and on which page).

Sessions are opaque `id.secret` pairs; only the SHA-256 of the secret is stored, cookies are
`HttpOnly; SameSite=Lax; Path=/`, and every state-changing request must echo the CSRF cookie in
the `x-csrf-token` header. `backend/.env`, `backend/data_base/db.json` and Atlas credentials are
never web-served, and the JSON store lives outside the served frontend folder.

## Roster access

Registration is closed. The only accounts the portal accepts are the emails printed on the group
rosters (the official Freshmen group PDFs), stored as an allow-list in the `roster` collection
(`authorizedStudents` in Atlas, `roster` in the JSON store).

1. `npm run extract:roster -- "D:\Freshmen fall 2026-2027 GA groups.pdf" "D:\Freshmen fall 2026-2027 GB groups.pdf"`
   reads the PDFs and writes `backend/data_base/roster.freshmen-fall-2026.json` plus a line-by-line
   `roster-report.txt` to review. Student emails are derived from the printed student id
   (`192600250` → `192600250@ecu.edu.eg`), so no email has to be typed by hand.
2. `npm run import:roster` writes those students, their groups and the teaching assistants printed
   on each page. It is idempotent (matched on email / exact group label) and never creates or edits
   an account, so re-running it after a new PDF batch is safe. `--dry-run` prints the counts only.
3. `npm run verify:roster` imports the same document into a throwaway store and asserts that every
   printed row, group size and TA assignment arrived, that a second import adds nothing, and that no
   password ever entered the allow-list. Add `--live` to check the real store read-only.

Sign-in is email first: `/api/auth/check-email` says whether the address is listed, then the student
either enters their password or chooses their first one (`/register`). The server re-reads the
allow-list on every one of those requests and takes the name, role and group from it, so a modified
request cannot pick a group or a role. An address that is not listed is refused with the same
wording in both steps and produces no account and no session. Being printed as a teaching assistant
only grants student-level access to the groups listed next to the name; staff accounts are still
created by an administrator.

## Data stores

| `DATA_STORE` | Behaviour |
| --- | --- |
| _(blank, default)_ | MongoDB when `MONGODB_URI` / username+password exist, otherwise local JSON |
| `mongo` | Atlas through `backend/config/db.js` (uses `MONGODB_HOSTS` + `MONGODB_REPLICA_SET` when the `mongodb+srv` DNS lookup is blocked) |
| `file` | `backend/data_base/db.json` – offline development, git-ignored |

## Troubleshooting

- **`SSL routines ... tlsv1 alert` or a timeout when seeding/starting with Atlas** – the database
  rejects the connection before authentication. Open Atlas → *Network access* and add the current
  public IP (or a narrow CIDR), then retry. `npm run test:db` isolates the problem quickly. For
  offline work set `DATA_STORE=file` and run `npm run dev`.
- **`Missing required env var: ADMIN_BOOTSTRAP_EMAIL`** – add the value to `backend/.env`, or run
  `npm run seed:demo`, which uses its own demo identity.
- **`SESSION_SECRET (min 32 chars) must be set`** – required when `NODE_ENV=production`; generate
  one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- **Sessions drop after every restart** – expected in development when `SESSION_SECRET` is empty
  (an ephemeral secret is generated); set it to keep sessions alive.

## Layout

```
backend/
  config/db.js          Atlas driver helper (env parsing, TLS, single cached connection)
  config/subject-catalog.json  default subject list used by seed-catalog.js
  scripts/              seed.js, seed-catalog.js, bootstrap-owner.js, extract-roster.js,
                        import-roster.js, verify-roster.js, smoke-test.js, page-smoke.js,
                        verify-documents.js; scripts/lib/ holds the PDF parser + store writers
  src/app.js            middleware order, routes, page guards, static hosting
  src/db/               store façade + file-store / mongo-store adapters
  src/lib/              sessions, password hashing, validation, DTOs, errors
  src/middleware/       auth, security headers, CSRF, rate limiting
  src/routes/           auth, public, user, admin, documents
  src/services/         documents.js - upload rules, storage paths, download rights
  storage/              uploaded files, outside the served tree, grouped <group>/<subject>/
frontend/
  guest/                public landing page
  user/                 signin, register, groups, profile, documents
  admin/                gateway + dashboard, accounts, groups, subjects, documents,
                        activity, information, profile
  shared/               api client, ui helpers, i18n, layout, base.css
```


## Subjects and documents

Every group is offered the same six starting subjects - Assessments, Materials, Announcements,
Projects, Schedules and Results - created by `npm run seed:catalog`. Staff add or archive
subjects under `/admin/subjects/`; a subject that still holds documents cannot be deleted, only
archived, and a group cannot be deleted while its folder still holds files.

Uploads travel as JSON (base64 inside the body) so no multipart parser is needed:

| Route | Who | Purpose |
| --- | --- | --- |
| `POST /api/admin/documents` | admin, superAdmin | upload one file: `group`, `subject`, `fileName`, `fileBase64`, optional `displayName`, `published` |
| `PATCH /api/admin/documents/:id` | admin, superAdmin | rename the label or toggle `published` |
| `DELETE /api/admin/documents/:id` | admin, superAdmin | delete the record and the stored bytes together |
| `GET /api/documents` | signed-in | list; a student only ever sees published files of their own approved group |
| `GET /api/documents/:id/file` | signed-in, if allowed | the file itself, as an attachment |

`backend/src/services/documents.js` enforces these rules whatever the route:

* the type comes from the leading bytes - PDF, PNG, JPG/JPEG, WebP, GIF. The declared extension
  must agree with the content, so a renamed executable, an HTML page or an SVG is refused.
  Office formats are not on the list yet: add one line to `ALLOWED` plus a signature test in
  `detectType()` when they are needed.
* size cap `UPLOAD_MAX_MB` (default 10, hard ceiling 100). The JSON body limit is derived from it
  so an oversized file is refused before it is decoded.
* the client file name is only a label. On disk the path is
  `backend/storage/<group>/<subject>/<random-token>.<ext>`, built from records the server already
  has, and every read re-resolves the key and proves it stays inside the storage root.
* `backend/storage` is never served as static content, so a file can only be fetched through the
  download route, which re-checks role, group and published flag on every request and answers with
  `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, a sandboxed CSP and
  `no-store`. "not yours" and "does not exist" both answer 404, so the route cannot be used to
  discover what another group holds.
* uploads are rate limited and need the CSRF token, like every other state-changing API call.
* nothing is virus scanned: files are stored and offered as downloads, never executed or rendered
  inline.

## Owner (super admin) bootstrap

`backend/scripts/bootstrap-owner.js` is the roster-gated way to create or update the owner account:

```
npm run bootstrap:owner -- --email=192600250@ecu.edu.eg --group=GA-6 --store=file --check
```

* `--check` reports what would happen and writes nothing; `--store=file|mongo` chooses the store
  (otherwise `DATA_STORE` or `.env` decides). Run `npm run import:roster` and
  `npm run seed:catalog` first, because the script needs the roster and the group to exist.
* the address must exist in the imported roster - that roster is the allow-list. The group and the
  full name are taken from the roster row, so `--group=GA6` is reported and corrected to `GA-6`
  rather than inventing a group.
* an existing account is raised to `superAdmin` and confirmed; its password is never read,
  changed or printed. Pass `--rotate-password` to set a new one deliberately.
* a new account needs a password. Give it through `--password-file=<path>` (only the path is an
  argument, the secret stays in the file — handy when editing `.env` is awkward), through
  `ADMIN_BOOTSTRAP_PASSWORD` in the environment, or let `--generate` create one and print it once.
  The secret itself is never a command-line argument, so it cannot land in shell history or a log.
  If both a file and `ADMIN_BOOTSTRAP_PASSWORD` are present the named file wins and the key is
  ignored. Delete a password file when the run is done, the portal never needs it again.
* `--name` only labels the account - the identity is the email. The roster row, other students and
  other staff are never modified. A space typed as `%20` is decoded, so `--name=Eng.youssef%20Mahmoud`
  stores "Eng.youssef Mahmoud". Omit `--name` to keep the full name from the roster.
