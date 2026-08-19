# Technet Enterprise Digital Ecosystem (TEDE) — Project Context

This file is a full handoff/onboarding summary for a new Claude session picking up work on this project. It covers what the project is, what's been built, why, and how work here is expected to be done. Read this before starting any task in this repo.

## 1. What this project is

**Technet Engineering** is a Mauritius-based multi-service engineering firm (10+ years old) doing electrical, ELV/security, mechanical, plumbing, and safety work for commercial customers. **TEDE (Technet Enterprise Digital Ecosystem)**, internally also called "Technet Digital," is a from-scratch internal web platform being built to digitize and unify their operations: sales, finance, procurement, HR/payroll, project/work-order management, field technician tracking, asset maintenance, and (eventually) customer self-service and marketing/analytics.

The user directing this work is a non-technical-to-semi-technical project assistant/coordinator relaying real requirements from Technet's managers (an Operations Manager and others) — many features in this project trace back to a specific manager's feedback about a real operational pain point (e.g., "we have trust issues with field technicians' whereabouts," "managers can't easily get exact GPS coordinates for a job site"). Expect requirements to keep arriving this way: informally described, sometimes needing clarification about the *actual* workflow before building.

There is a formal **SDD (Software Design Document)**, the actual source of truth for scope — supplied by the user on 2026-08-19 at `C:\Users\User\Downloads\Technet Engineering SDD (1).pdf`. It's a from-scratch academic/internship deliverable (8 chapters: System Overview, Software Architecture, Technology Stack, Database Design, API Design, Security Architecture, UI/UX Design, Deployment Architecture), produced independently of this codebase, describing a *proposed* design — not a spec this repo was built to match. Actual implementation predates/diverges from it in several deliberate ways (see §11 below). A flowchart image was also shared once (2026-08-14) summarizing planned modules/roles/integrations — the user clarified that was just illustrative conversation, not the authoritative doc; the SDD PDF is authoritative.

## 2. Tech stack

- **Monorepo**: npm workspaces, two packages: `client/` and `server/`.
- **Client**: React 19 + TypeScript + Vite. Routing via `react-router-dom` v7. Styling: Tailwind CSS v4. Icons: `lucide-react`. No UI component library — hand-built components in `client/src/dashboard/ui.tsx` (Panel, Badge, Modal, EmptyState, TableSkeleton, StatCard, etc.) reused everywhere.
- **Server**: Node.js + Express 5 + TypeScript, run via `tsx`. Auth via JWT in an httpOnly cookie (not bearer tokens) — see `server/src/routes/auth.ts`.
- **Database**: PostgreSQL via **Prisma ORM 7.x** using the `@prisma/adapter-pg` driver adapter (not Prisma's default engine). Hosted on **Neon** (serverless Postgres — has a cold-start delay of ~2.5–9s after idle; don't mistake this for a bug when a page looks stuck loading right after a period of inactivity).
- **Testing**: `vitest` on the server (`npm run test -w server`), currently 47 tests across lib helpers and a few route smoke tests. No client automated test suite — client changes are verified via `tsc -b` (typecheck) and manual/Playwright browser checks.
- **Email**: Resend (password reset emails).
- **PDF generation**: `pdfkit` (quotations/invoices/purchase order documents).

## 3. Deployment topology

- **Client** → Cloudflare Workers (via `wrangler`, static SPA build with `not_found_handling: single-page-application`). Domain: `technet-digital.workers.dev` (or a custom domain pointed at it).
- **Server** → Railway (Node host running the compiled Express app; `railway.json` builds with `npm run build -w server` and starts with `npm run start -w server`, which runs `prisma migrate deploy` before booting).
- **Database** → Neon Postgres.
- Client and server are different origins in production, so auth cookies use `SameSite=None; Secure; Partitioned` in prod and `SameSite=Lax` in dev (see the cookie config comment in `server/src/routes/auth.ts` — this was hard-won; don't simplify it without understanding why).
- **Known deploy gotcha**: Cloudflare has intermittently served stale cached HTML/JS after a successful deploy (`CF-Cache-Status: HIT` with old content, confirmed via direct `curl`, not just browser cache). Fix: push a fresh commit to force a new deploy version. If "I don't see the new feature" comes up after confirming a deploy succeeded, check `CF-Cache-Status` via curl before assuming the code is wrong.

## 4. Repo structure

```
Technet-Enterprise-Digital-Ecosystem/
├── client/src/
│   ├── erp/            Sales/Finance/Procurement/Projects/Documents/HR pages
│   │   └── hr/          HR sub-module (employees, leave, attendance, certifications)
│   ├── maintenance/     Technet Maintenance module (assets, contracts, requests, schedule)
│   ├── operations/      Technet Operations module (work orders, reports, attendance, field ops)
│   ├── workforce/       Technet Workforce module (payroll only, so far)
│   ├── dashboard/       Shared shell: nav, sidebar, layout, reusable UI kit, AttendanceWidget
│   ├── lib/             api.ts (all HTTP calls + types), permissions.ts, geolocation.ts, csv.ts
│   └── context/         AuthContext
├── server/
│   ├── src/routes/      One file per resource, mounted in src/index.ts
│   ├── src/lib/         geo.ts, geocode.ts, roles.ts, jwt.ts, prismaErrors.ts, etc.
│   └── prisma/          schema.prisma + migrations/
├── README.md            Setup/dev instructions (stack, env vars, deployment table)
└── CLAUDE.md            This file
```

A **separate, sibling directory** `Technet TEDE/pw-check/` (one level up from the repo, NOT inside git) holds ad-hoc Playwright verification scripts and screenshots used to visually confirm features work end-to-end. It has its own `node_modules`. Disposable — scripts get written, run, and deleted after each verification; a few leftover screenshots may remain. Similarly, disposable server-side smoke-test scripts are written as `server/scratch-*.ts` (using `tsx`, real bcrypt hashing, direct Prisma calls + real `fetch` calls against the running dev server), always cleaned up (data deleted, file removed) after use — never committed.

## 5. Modules — what's actually built vs. stubbed

Everyone lands on **Overview** (`/dashboard`) — a dashboard home with mock "system health" tiles (decorative, not real data) plus the real **My Attendance** widget for linked employees.

| Module | Status | Notes |
|---|---|---|
| **Technet ERP** | Built | Umbrella for Sales/Finance, Procurement, HR, Projects, Documents, Inventory |
| — Inventory | Built | Items, stock movements |
| — Finance | Built | Customers, Invoices (+PDF), Expenses, Quotations (+PDF), Contracts |
| — Procurement | Built | Suppliers, Requisitions, Purchase Orders (+PDF), goods receipt |
| — HR | Built | Employee profiles, Leave (types/balances/requests/timesheet), Attendance (office clock-in/out, separate from Operations GPS attendance), Certifications & Training |
| — Projects | Built | Project registry, assignments, status history |
| — Documents | Built | File storage (DB `Bytes` column, not S3/cloud storage), categorized by Contract/Invoice/HR/Project/General |
| **Technet Maintenance** | Built | Assets, Maintenance Contracts, Maintenance Requests, Maintenance Schedule/Reports — built explicitly "from the SDD" per commit history |
| **Technet Operations** | Built | Work Orders, Daily Reports, Intervention Reports, Team Attendance, Field Operations — see §7, this is where most recent work has concentrated |
| **Technet Workforce** | Partially built | Only Payroll (run creation, per-employee line breakdown, net pay computation) is built. HR-gated (hidden from field-only roles). |
| **Technet Connect** | **Stub only** (`ModuleStub`) | Meant to be a customer self-service portal (register/login, request quotations, track status, view invoices/receipts) per the flowchart — not started |
| **Technet Digital Marketing** | **Stub only** | Meant for campaign creation, AI content generation, scheduling/analytics per the flowchart — not started |
| **Technet Insight** | **Stub only** | Meant to be an executive dashboard (real-time KPIs, drill-down reports) per the flowchart — not started |
| **Security** (System nav) | **Stub only** | — |
| Settings, User Management | Built | Admin-only user management (`/dashboard/users`), self-service password change |

Also **not built** (per the flowchart, confirmed unimplemented): a biometric/facial-recognition attendance-machine integration for office staff ("Attendance Sync" under Workforce is currently just a decorative dashboard tile), SMS gateway, general AI content-generation service, cloud file storage (documents are DB blobs today), and a Notifications system (in-app/email/SMS).

## 6. Roles & access control (RBAC)

Actual `Role` enum (`server/prisma/schema.prisma`, mirrored in `server/src/lib/roles.ts` and `client/src/lib/permissions.ts` — **no shared package, keep both in sync manually**):

```
ADMIN, SALES_OFFICER, FINANCE_OFFICER, STOREKEEPER, HR_OFFICER,
OPERATIONS_MANAGER, FIELD_TECHNICIAN, EMPLOYEE
```

Note: this is narrower than the roles shown on the flowchart shared 2026-08-14 (which also listed Managing Director, Marketing Officer, and a Customer role) — those aren't implemented; don't assume they exist without checking.

Role groups used for gating (server `roles.ts` / client `permissions.ts`):
- `OPS_MANAGE_ROLES` = ADMIN, OPERATIONS_MANAGER — create/edit/delete/approve on Operations records.
- `OPS_SUBMIT_ROLES` = ADMIN, OPERATIONS_MANAGER, FIELD_TECHNICIAN, EMPLOYEE — submitting field-generated records (check-ins, daily reports, intervention reports).
- `NON_FIELD_ROLES` / `FIELD_ONLY_ROLES` — as of 2026-08-13, **FIELD_TECHNICIAN and EMPLOYEE are restricted client- and server-side to Overview + Technet Operations + Technet Maintenance only**. They cannot see or hit the API for ERP/Connect/Workforce/Marketing/Insight. This was an explicit request ("everyone is not supposed to see everything") — enforced both by hiding nav items (`NavItem.hiddenFrom`) and by blocking the actual routes server-side (`requireRole(...NON_FIELD_ROLES)` prepended to 11 route files), not just cosmetically. `RoleRoute.tsx` (client) is the reusable route-level gate; `AdminRoute.tsx` is the older admin-only equivalent kept for `/dashboard/users`.
- Various per-module role groups: `SALES_ROLES`, `FINANCE_ROLES`, `PROCUREMENT_ROLES`, `HR_ROLES`, `DOCUMENT_ROLES`.

## 7. Technet Operations — the most actively developed area

This is where nearly all recent sessions' work has concentrated. Sub-pages: Work Orders, Daily Reports, Intervention Reports, Team Attendance, Field Operations.

### 7a. GPS site attendance — current architecture (as of 2026-08-14)

**There is exactly one check-in surface**: the "My Attendance" widget on the dashboard Overview page (`client/src/dashboard/AttendanceWidget.tsx`), calling `POST /api/site-attendance/check-in`. No daily limit — a technician can check in/out repeatedly as they visit different sites in a day.

At check-in, the server (`findCurrentWorkOrder()` in `server/src/routes/siteAttendance.ts`) automatically figures out the technician's **current work order** — first an `IN_PROGRESS` one they're assigned to, else a `SCHEDULED` one for today — and links `SiteAttendance.workOrderId` to it. **No manual picker, no second check-in button.** If that work order has a resolved site location, the check-in is geofenced (150m radius, haversine distance in `server/src/lib/geo.ts`) — but **geofencing is advisory only, never blocking**: check-in always succeeds; being far away is recorded and shown to managers as an `OUTSIDE_SITE` status immediately (an initial `SiteVerification` row is created from the check-in's own coordinates), not rejected.

While checked in and linked to a geofenced work order: a 10-minute foreground-only `setInterval` (plus a manual "Verify My Location" button) periodically re-checks location, recording `ON_SITE`/`OUTSIDE_SITE`. If the latest status is `OUTSIDE_SITE`, an inline (non-blocking) panel prompts for a reason (materials / another site / supervisor instruction / emergency / other).

Manager visibility: **Team Attendance** (`OPS_MANAGE_ROLES`, shows everyone's daily check-ins with linked work order + status if any) and **Field Operations** (`OPS_MANAGE_ROLES`, focused view of just the work-order-linked sessions — who's in the field, time on site, last verified location, exit-event history).

**A second, work-order-specific check-in flow was briefly built (2026-08-13) then fully retired the same day** after the user caught that it was the wrong shape — the trust/tracking features were supposed to extend the *existing* daily check-in, not add a competing one on the Work Order Detail page. `WorkOrderDetailPage.tsx` is now purely read-only for attendance (status badge + Site Attendance table). **If asked to touch check-in behavior again: do not add check-in controls to the work order page.** Everything belongs on `AttendanceWidget.tsx`.

### 7b. Site locations — address search, not coordinates (2026-08-14)

Originally, managers pasted a `"lat, lng"` string copied from Google Maps to set a work order's site location. This was dropped entirely after real friction: a manager was rejected 919m from an assigned site after a slightly-off paste, and the workflow itself doesn't support it well — managers assign work remotely (not standing at the site), and one customer often has multiple distinct locations, so there's no customer-level address to default to.

Now: a manager types a **place/address** (e.g. "Ebene, Mauritius") on work order create or the detail-page editor, and the server geocodes it via **OpenStreetMap Nominatim** (`server/src/lib/geocode.ts`) — free, no API key, no billing account. The resolved `WorkOrder.siteAddress` (a human-readable display name) is shown back so the manager can confirm the lookup found the right place.

**Important tested limitation, confirmed against the real API**: Nominatim geocodes addresses/place names, not business names. `"Technet Engineering Limited, Pont Saint Louis"` → zero results; `"Pont Saint Louis, Mauritius"` alone → resolves fine. OpenStreetMap is volunteer-mapped, so major landmarks (tested: "Bagatelle Mall") resolve but small local businesses (tested: "Technet Engineering", a bank branch by name) usually don't. **This is a known, accepted tradeoff, not a bug** — the user explicitly decided (2026-08-14) to stay on free Nominatim for now rather than switch to Google's Geocoding API (which has far better business coverage but requires the user to set up a Google Cloud billing account + API key). They said they'd raise the Google option with their manager later. **Don't switch geocoding providers unprompted** if this comes up again — the user is already aware of the tradeoff and made a deliberate choice.

The field's placeholder/hint text and the 400 error message both explicitly say "use an area/street/town name, not a company name" — this was fixed after discovering the *original* placeholder example itself didn't resolve either.

### 7c. List filtering (added 2026-08-14, same pattern across three pages)

Intervention Reports, Work Orders, and Daily Reports all support `from`/`to` date-range query params (inclusive, `gte`/`lte` on the relevant date field — `date` for reports, `scheduledDate` for work orders), plus additional filters per page:
- Intervention Reports: + customer, status, due-reminders-only, job category, work type.
- Work Orders: + customer, assigned technician.
- Daily Reports: date range only so far.

Pattern to reuse if asked to add more filters anywhere: a `parseDateOnly()` helper per route file (regex-matches `YYYY-MM-DD`, inclusive end-of-day via `+24h - 1ms`), a `Filters` state object or individual `useState`s on the client wired to a `load()` call in a `useEffect`, and a filter row (`label` + `select`/`input[type=date]`) above the table inside the existing `Panel`.

### 7d. Evidence capture

`InterventionReport` (the existing "inspection report" record — customer, equipment, fault description, action taken, technician report, signature, attachment) was extended rather than replaced: `PhotoKind` enum gained `BEFORE`/`AFTER` (alongside existing `EQUIPMENT`/`WORK_DONE`), plus a `materialsUsed` text field.

## 8. Data model overview (Prisma, `server/prisma/schema.prisma`)

Grouped by domain (not exhaustive on fields — read the schema for that):

- **Auth/Users**: `User` (role, passwordHash), `PasswordResetToken`.
- **HR**: `Employee` (optionally linked 1:1 to a `User` via `userId` — **this link is required for GPS attendance, payroll, etc. to work for that person**; set via HR → Employees → Edit → "Linked Login"), `Certification`, `TrainingRecord`, `AttendanceRecord` (office clock-in/out, HH:MM strings, separate system from GPS `SiteAttendance`), `LeaveType`/`LeaveBalance`/`LeaveRequest`.
- **Sales/Finance**: `Customer`, `Contract`, `Quotation`/`QuotationItem`, `Invoice`/`InvoiceItem`, `Expense`.
- **Procurement**: `Supplier`, `PurchaseOrder`/`PurchaseOrderItem`, `PurchaseRequisition`/`PurchaseRequisitionItem`/`RequisitionStatusHistory`, `GoodsReceipt`/`GoodsReceiptItem`, `InventoryItem`, `StockMovement`.
- **Projects/Documents**: `Project`, `ProjectAssignment`, `ProjectStatusHistory`, `Document` (bytes stored in-DB).
- **Operations**: `WorkOrder` (+ `siteLat`/`siteLng`/`siteAddress`), `WorkOrderTechnician`, `SiteAttendance` (+ `verifications`), `SiteVerification`, `DailyWorkReport`/`DailyWorkReportTechnician`/`DailyWorkReportWorkOrder`, `InterventionReport`/`InterventionReportTechnician`/`InterventionReportPhoto`.
- **Maintenance**: `Asset`, `MaintenanceContract`, `MaintenanceRequest`, `MaintenanceSchedule`/`MaintenanceScheduleTechnician`, `MaintenanceReport`.
- **Workforce**: `PayrollRun`, `PayrollLine`.

## 9. Working conventions (important — established through explicit user correction)

- **Commit granularity**: commit and push **every single file change individually**, immediately after it's verified working (a passing `tsc`/build), not batched by feature or held until a todo list is "done." This was corrected twice by the user (once early on, once again on a ~15-file RBAC pass) — don't let "commit" become a single final step.
- **Verification pattern**: for server logic, write a disposable `server/scratch-*.ts` script (dotenv + tsx + real Prisma calls + real `fetch` against the running dev server, cookie-based auth via parsing `Set-Cookie`), run it, confirm PASS/FAIL output, then delete it. For visual/UI confirmation, write a disposable script in the sibling `pw-check/` directory using Playwright, screenshot key states, read the screenshots, then delete the script.
- **Neon cold starts**: a screenshot taken immediately after an action can catch a stale/loading intermediate render (2.5–9s delay after DB idle). Don't conclude a regression from a single quick screenshot — reload with a longer wait and/or check the database directly before concluding something's broken.
- **Honesty constraints** (a recurring theme — don't fake capabilities that don't exist): no embedded interactive map anywhere (no Google Maps API key configured; every location is a plain `mapLink()` → `google.com/maps?q=lat,lng` URL); GPS "periodic" tracking is inherently foreground-tab-only in a browser SPA (no service worker); geocoding is a free best-effort service, not pinpoint-accurate. These limitations are meant to be surfaced explicitly to the user, not hidden.
- **Keep the interface simple** — many of Technet's technicians are not highly technical. Prefer extending existing UI surfaces over adding new ones (see §7a — the two-check-in mistake is the cautionary example).
- Prisma migrations: `prisma migrate dev` can hang indefinitely in this non-interactive shell environment (it waits on an interactive prompt with no stdin attached). If it hangs, kill it and instead hand-write the migration SQL file under `prisma/migrations/<timestamp>_<name>/migration.sql` following the existing folder convention, then apply with `prisma migrate deploy` (non-interactive), then `prisma generate`.

## 11. SDD vs. actual implementation — known divergences

The SDD (see §1) describes a *proposed* design from an internship research effort; this repo is the real, independently-evolved implementation. Treat the SDD as background/rationale, not a spec to conform to. Known gaps, as of 2026-08-19:

- **Backend/auth**: SDD proposes JWT + OAuth 2.0, Redis caching, AWS S3/Azure Blob for documents, Google Maps API for GPS, 8 separate PostgreSQL schemas. Actual: JWT-only in an httpOnly cookie (no OAuth 2.0, no Redis), documents stored as DB `Bytes` columns (not cloud storage), free OpenStreetMap Nominatim for geocoding (not Google Maps — a deliberate cost tradeoff, see [[feedback-geocoding-provider-choice]]), and a single default Postgres schema (not split by domain).
- **Mobile**: SDD proposes a React Native mobile app for technicians (struck through/crossed out in the SDD's own tech stack table on p.28-29, suggesting it was already being deprioritized during the SDD's own authoring). Actual: no native/React Native app exists — field technicians use the responsive web client.
- **AI features**: SDD describes an AI quotation assistant and AI-assisted marketing content generation via OpenAI/Azure OpenAI. Actual: no AI integration exists yet; Technet Digital Marketing is a stub.
- **Email-based quotation intake**: SDD describes parsing inbound customer emails into quotation requests (§2.7.1, §5.14.1) as a deliberate channel alongside the portal, with indicative per-email costs discussed. Not implemented — Technet Connect itself is still a stub.
- **Attendance machine integration**: SDD's Workforce module centers on syncing the existing facial-recognition attendance machine. Actual: "Attendance Sync" is still a decorative stub tile; office attendance is a separate manual `AttendanceRecord` HR feature, distinct from the GPS-based `SiteAttendance` system that Operations actually uses (see §7a) — the SDD's Attendance Sync and this repo's GPS site attendance are two different things with similar names, don't conflate them.
- **RBAC granularity**: SDD's role list (Chapter 1, 6) includes Managing Director as a distinct role from Administrator, plus a Customer role. Actual `Role` enum (§6 above) has no separate Managing Director or Customer role — ADMIN covers that ground, and there's no customer-facing auth at all yet since Connect is unbuilt.
- **Module naming**: what the SDD calls "Technet Workforce" (attendance sync + leave + payroll) is split in the actual repo — HR leave/attendance lives under ERP → HR, while `workforce/` only holds Payroll.

If a future task references something from the SDD (a specific API path like `/api/v1/quotations/{id}/approve`, a table/column name, a security control), verify it against the actual code first — the SDD was written independently and predates or idealizes parts of what's actually built.

## 12. Where to look for more history

- `git log --oneline` in the repo root — 173+ commits from 2026-07-20 to present, one logical change per commit with descriptive messages (per the convention above), effectively a full changelog.
- The auto-memory system (Claude-side, not in this repo) tracks: commit-granularity feedback, the GPS-attendance feature's evolving architecture, the deliberate geocoding-provider choice, and now the SDD's location and divergences from actual implementation (§11) — this document folds their content in, but they may have been updated further since this file was written.
