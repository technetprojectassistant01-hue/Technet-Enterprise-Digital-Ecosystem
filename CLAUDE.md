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
- **Server** → Render (Node host running the compiled Express app; `render.yaml` Blueprint builds with `npm ci --include=dev && npm run build -w server` and starts with `npm run start -w server`, which runs `prisma migrate deploy` before booting). Migrated from Railway 2026-08-24 after its free trial ran out — free-tier tradeoff: the service sleeps after ~15 min idle, so the first request after a quiet period can take 30-60s. `railway.json` is left in the repo as inert historical reference, not used by anything. **Build gotcha**: `NODE_ENV=production` (needed at runtime for cookie behavior, see below) also applies during Render's build step, which makes a plain `npm ci` skip devDependencies the build itself needs (`typescript`, `@types/*`, `vitest`) — `--include=dev` forces them in regardless. If a future Render deploy fails with `TS7016`/`TS7006`/"Cannot find module 'vitest'", this is almost certainly the cause.
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
│   ├── workforce/       Technet Workforce module (Availability, Attendance, Payroll)
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

Everyone lands on **Overview** (`/dashboard`) — as of 2026-08-19 this is real, not decorative: a "Recent Activity" panel of actual notifications and a role-aware "Quick Stats" row (each tile backed by a real endpoint, only shown to roles that can access it), plus the real **My Attendance** widget for linked employees. (It used to be fake "system health" tiles — see git history 2026-08-19 "Replace the fake Overview dashboard with real data" if that's referenced anywhere stale.)

| Module | Status | Notes |
|---|---|---|
| **Technet ERP** | Built | Umbrella for Sales/Finance, Procurement, HR, Projects, Documents, Inventory |
| — Inventory | Built | Items, stock movements |
| — Finance | Built | Customers, Invoices (+PDF), Quotations (+PDF, see the Quotation-rework note below, and §10d for the 2026-08-27 Call Log/payment-terms/validity/Product Line addendum), Follow-Up of Quotation, Expenses, Contracts |
| — Procurement | Built | Suppliers, Requisitions, Purchase Orders (+PDF), goods receipt |
| — HR | Built | Employee profiles, Leave (types/balances/requests/timesheet, public holiday calendar excluded from working-day counts — added 2026-08-20, manually maintained since several Mauritius holidays are lunar/gazette-dependent), Certifications & Training. **Attendance moved to Technet Workforce 2026-08-20** — see below. Self-service leave requests for employees added 2026-08-26 — see §10b. |
| — Projects | Built | Project registry, assignments, status history |
| — Documents | Built | File storage (DB `Bytes` column, not S3/cloud storage), categorized by Contract/Invoice/HR/Project/General/Quotation |
| **Technet Maintenance** | Built | Assets, Maintenance Contracts, Maintenance Requests, Maintenance Schedule/Reports — built explicitly "from the SDD" per commit history |
| **Technet Operations** | Built | Work Orders (now with a `WAITING_FOR_PARTS`/`REOPENED` lifecycle, added 2026-08-19), Daily Reports, Intervention Reports, Team Attendance, Field Operations — see §7, this is where most recent work has concentrated |
| **Technet Workforce** | Built | Restructured 2026-08-20 per manager/stakeholder discussion, to stop ERP HR and Workforce covering the same ground. Three tabs: **Availability** (`/dashboard/workforce/availability`, default landing page) — read-only "who's available today" grouped into Available/On Leave/Absent, built on the existing manual attendance register (no real biometric attendance-machine integration exists — see §11), visible to HR **and Operations Managers** (`WORKFORCE_VIEW_ROLES`) since Operations consults it before assigning jobs, though job assignment itself stays in Operations, not Workforce. **Attendance** (moved from ERP HR — daily register + timesheets, HR-only edit rights). **Payroll** (run creation, per-employee line breakdown, net pay computation, HR-only). |
| **Technet Connect** | **Built** (2026-08-24) | Customer self-service portal at `/portal/*` — a fully separate auth domain from staff, not the internal `Role` enum (see §6). Customers view their own quotations/invoices (SENT+ only, drafts hidden) with PDF download, track job/work-order status (customer-safe field subset — no GPS, no technician names), and submit quote requests. Staff grants/resets/revokes portal access from the Customers page (`/dashboard/erp/finance/customers`), and manages incoming requests from a new "Quote Requests" tab on the Quotations page, converting one into a real draft `Quotation`. No self-registration — staff-granted only. |
| **Technet Digital Marketing** | **Built — Phase 1 only** (2026-08-26) | `/dashboard/marketing` — Campaigns (`MarketingCampaign`) and a flat, filterable Content Calendar across all campaigns' `MarketingPost`s (title/platform/copy/scheduled date/status). Deliberately no AI, no auto-publish, no real platform integrations (Phases 2/3 of a 3-phase scoping plan — see §10a) — Marketing plans posts here and marks them Posted by hand after publishing elsewhere themselves. Gated to `MARKETING_ROLES` (ADMIN + SALES_OFFICER — no confirmed real owner yet, see §6). |
| **Technet Insight** | **Built** (2026-08-19) | Read-only executive KPI dashboard (`/dashboard/insight`) — revenue, active projects/work orders, overdue invoices, open maintenance requests, low stock, technicians on site. **ADMIN-only** (no Managing Director role exists — see §11) |
| **Security** (System nav) | **Built** (2026-08-24) | `/dashboard/security` — "My Account" tab (any authenticated user: their own recent login history, `SecurityEvent` model) + "Audit Log" tab (ADMIN-only: company-wide, filterable by event type/date, paginated). Scoped to genuinely security-relevant events only (login success/fail, password change/reset, user create/role-change/delete) — deliberately not a general change-history log across every ERP record. Also added a "Reset Password" action to User Management (`/dashboard/users`), which was already a supported API capability but never exposed in the UI. |
| Settings, User Management | Built | Admin-only user management (`/dashboard/users`), self-service password change |
| **Notifications** | **Built** (2026-08-19), in-app only | `server/src/lib/notifications.ts` (`notifyUser`/`notifyEmployee`/`notifyRoles`), `/api/notifications`, bell icon in `Dashboard.tsx` header (`NotificationBell.tsx`) + Overview's Recent Activity panel. Triggers so far: leave approve/reject, requisition approve/reject, work order technician assignment, quotation accept/reject, intervention report submit+review, maintenance request schedule/cancel, maintenance report submit+review+completion, project assignment, supervisor-requested location check (§13 item 2). No email/SMS — in-app polling only (60s). |

Also **not built** (per the flowchart, confirmed unimplemented): a biometric/facial-recognition attendance-machine integration for office staff ("Attendance Sync" under Workforce is currently just a decorative dashboard tile), SMS gateway, general AI content-generation service, cloud file storage (documents are DB blobs today), and email notifications (in-app notifications now exist, see table above).

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
- `WORKFORCE_VIEW_ROLES` = ADMIN, HR_OFFICER, OPERATIONS_MANAGER — added 2026-08-20 for Technet Workforce's Availability view specifically; Attendance edit rights and Payroll stay `HR_ROLES`-only.
- `CUSTOMER_MANAGE_ROLES` = ADMIN, SALES_OFFICER, FINANCE_OFFICER — added 2026-08-25, customer create/edit access, separate from `SALES_ROLES` since that's also used for Quotations (Finance wasn't asked to gain write access there).
- `QUOTE_REQUEST_VIEW_ROLES` = ADMIN, SALES_OFFICER, OPERATIONS_MANAGER — added 2026-08-25, read-only visibility into the Quote Request queue for Operations Managers; creating/converting/declining stays `SALES_ROLES`-only. See §10.
- `MARKETING_ROLES` = ADMIN, SALES_OFFICER — added 2026-08-26 for Technet Digital Marketing Phase 1. No Technet stakeholder has confirmed who owns marketing yet, so this defaults to Sales as the closest adjacent function, same pragmatic pattern as `CUSTOMER_MANAGE_ROLES`. Read access is broader (`NON_FIELD_ROLES`, same as the rest of ERP-ish modules); only writes are gated to `MARKETING_ROLES`. See §10a.

**Customer portal auth is a separate domain, not a 9th `Role`.** Technet Connect (`/portal/*`, added 2026-08-24) does not reuse `Role`/`requireAuth`/`requireRole` at all — a `CustomerPortalUser` login gets its own cookie (`portal_token`, not `token`), its own JWT signing (`server/src/lib/portalJwt.ts`, `verifyPortalToken`) carrying a distinct `audience: "portal"` claim, and its own middleware (`requirePortalAuth`, sets `req.portalUser`, never `req.user`). This was deliberate: adding a `CUSTOMER` role into the existing enum would have meant auditing every broad allow-list (`NON_FIELD_ROLES`, etc.) across dozens of routes to make sure a customer token could never slip through. The `audience` claim is the actual enforcement point — verified in this session that a genuine staff JWT placed directly in the `portal_token` cookie is rejected outright, not just kept out by cookie-name convention.

On the client, note that `AuthProvider` (staff, `client/src/context/AuthContext.tsx`) is mounted at the app root in `main.tsx`, above `<App/>` — so it runs on *every* route including `/portal/*`, even though staff and portal never share a cookie. Fixed 2026-08-25 (`32c1ccf`): its mount-time `/api/auth/me` check now short-circuits when `window.location.pathname` starts with `/portal`, since that call was guaranteed to 401 there and was pure noise. It's still mounted globally (not worth restructuring the provider tree for this), just skips the fetch on portal paths.

## 7. Technet Operations — the most actively developed area

This is where nearly all recent sessions' work has concentrated. Sub-pages: Work Orders, Daily Reports, Intervention Reports, Team Attendance, Field Operations.

### 7a. GPS site attendance — current architecture (as of 2026-08-14)

**There is exactly one check-in surface**: the "My Attendance" widget on the dashboard Overview page (`client/src/dashboard/AttendanceWidget.tsx`), calling `POST /api/site-attendance/check-in`. No daily limit — a technician can check in/out repeatedly as they visit different sites in a day.

At check-in, the server (`findCurrentWorkOrder()` in `server/src/routes/siteAttendance.ts`) automatically figures out the technician's **current work order** — first an `IN_PROGRESS` one they're assigned to, else a `SCHEDULED` one for today — and links `SiteAttendance.workOrderId` to it. **No manual picker, no second check-in button.** If that work order has a resolved site location, the check-in is geofenced (150m radius, haversine distance in `server/src/lib/geo.ts`) — but **geofencing is advisory only, never blocking**: check-in always succeeds; being far away is recorded and shown to managers as an `OUTSIDE_SITE` status immediately (an initial `SiteVerification` row is created from the check-in's own coordinates), not rejected.

While checked in and linked to a geofenced work order: a 10-minute foreground-only `setInterval` (plus a manual "Verify My Location" button) periodically re-checks location, recording `ON_SITE`/`OUTSIDE_SITE`. If the latest status is `OUTSIDE_SITE`, an inline (non-blocking) panel prompts for a reason (materials / another site / supervisor instruction / emergency / other).

Manager visibility: **Team Attendance** (`OPS_MANAGE_ROLES`, shows everyone's daily check-ins with linked work order + status if any) and **Field Operations** (`OPS_MANAGE_ROLES`, focused view of just the work-order-linked sessions — who's in the field, time on site, last verified location, exit-event history).

Team Attendance gained a **per-technician filter and monthly summary** (2026-08-26, `2418e54`/`a1b485f`): `GET /api/site-attendance` takes an optional `employeeId` (filters both the live "currently checked in" list and the month's history) and now also returns a `summary` array — one row per technician for the selected month (days present, total check-ins, hours on site, on-site vs. outside-site verification counts), computed by grouping the same `history` rows already being fetched rather than a separate query. The on-site/outside-site counters exist specifically because trust in field technicians' whereabouts is the whole reason this GPS system was built (see §1) — a manager scanning for a high outside-site count is the actual use case.

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

Same pattern applied to the **Asset Registry** (2026-08-26, `dd8d288`/`734dfba`): Customer, Status, and Category filters (search broadened to also match `location`, not just name/serial). One thing worth remembering for any filter whose options come from the data itself (not a fixed enum) — Category here is a free string, not an enum, so its dropdown options are derived from a **separate, one-time unfiltered fetch** on mount, not from the currently-filtered `assets` list. Deriving options from the filtered list creates a real bug: picking a category narrows the list to just that category, which then narrows the dropdown down to just the one option left visible, hiding every other choice from the user.

Extended the same day to the rest of Technet Maintenance (2026-08-26, `3861d07`/`7f36c84`/`293e93a`) — Contracts, Requests, and Schedule all replaced their old status-only pill-button row with a full live-filtered dropdown/date row, matching Assets exactly. None of `MaintenanceContract`/`MaintenanceRequest`/`MaintenanceSchedule` has a direct `customerId` column — customer is reached through the `asset` relation (`where.asset = { customerId }`), except **Schedule**, which links to an asset via *either* `contract` or `request` (both optional), so its customer filter is a relation `OR`: `where.OR = [{ contract: { asset: { customerId } } }, { request: { asset: { customerId } } }]`. Also picked up Requests/Schedule gaining a Customer table column (previously asset-only) and Contracts wiring up its `expiringSoon` API param, which existed server-side already but had no UI control before this pass.

### 7d. Evidence capture

`InterventionReport` (the existing "inspection report" record — customer, equipment, fault description, action taken, technician report, signature, attachment) was extended rather than replaced: `PhotoKind` enum gained `BEFORE`/`AFTER` (alongside existing `EQUIPMENT`/`WORK_DONE`), plus a `materialsUsed` text field.

## 8. Data model overview (Prisma, `server/prisma/schema.prisma`)

Grouped by domain (not exhaustive on fields — read the schema for that):

- **Auth/Users**: `User` (role, passwordHash), `PasswordResetToken`.
- **HR**: `Employee` (optionally linked 1:1 to a `User` via `userId` — **this link is required for GPS attendance, payroll, etc. to work for that person**; set via HR → Employees → Edit → "Linked Login"), `Certification`, `TrainingRecord`, `AttendanceRecord` (office clock-in/out, HH:MM strings, separate system from GPS `SiteAttendance`), `LeaveType`/`LeaveBalance`/`LeaveRequest`.
- **Sales/Finance**: `Customer`, `Contract`, `Quotation`/`QuotationItem`/`QuotationFollowUp`, `QuotationRequest` (staff-logged intake or portal-submitted, converts into a `Quotation`), `Invoice`/`InvoiceItem`, `Expense`. See §10 for the 2026-08-25 quotation rework.
- **Procurement**: `Supplier`, `PurchaseOrder`/`PurchaseOrderItem`, `PurchaseRequisition`/`PurchaseRequisitionItem`/`RequisitionStatusHistory`, `GoodsReceipt`/`GoodsReceiptItem`, `InventoryItem`, `StockMovement`.
- **Projects/Documents**: `Project`, `ProjectAssignment`, `ProjectStatusHistory`, `Document` (bytes stored in-DB).
- **Operations**: `WorkOrder` (+ `siteLat`/`siteLng`/`siteAddress`), `WorkOrderTechnician`, `SiteAttendance` (+ `verifications`), `SiteVerification`, `DailyWorkReport`/`DailyWorkReportTechnician`/`DailyWorkReportWorkOrder`, `InterventionReport`/`InterventionReportTechnician`/`InterventionReportPhoto`.
- **Maintenance**: `Asset`, `MaintenanceContract`, `MaintenanceRequest`, `MaintenanceSchedule`/`MaintenanceScheduleTechnician`, `MaintenanceReport`.
- **Workforce**: `PayrollRun`, `PayrollLine`.
- **Marketing**: `MarketingCampaign`, `MarketingPost` — Phase 1 only, see §10a.

## 9. Working conventions (important — established through explicit user correction)

- **Commit granularity**: commit and push **every single file change individually**, immediately after it's verified working (a passing `tsc`/build), not batched by feature or held until a todo list is "done." This was corrected twice by the user (once early on, once again on a ~15-file RBAC pass) — don't let "commit" become a single final step.
- **Verification pattern**: for server logic, write a disposable `server/scratch-*.ts` script (dotenv + tsx + real Prisma calls + real `fetch` against the running dev server, cookie-based auth via parsing `Set-Cookie`), run it, confirm PASS/FAIL output, then delete it. For visual/UI confirmation, write a disposable script in the sibling `pw-check/` directory using Playwright, screenshot key states, read the screenshots, then delete the script.
- **Neon cold starts**: a screenshot taken immediately after an action can catch a stale/loading intermediate render (2.5–9s delay after DB idle). Don't conclude a regression from a single quick screenshot — reload with a longer wait and/or check the database directly before concluding something's broken.
- **Honesty constraints** (a recurring theme — don't fake capabilities that don't exist): no embedded interactive map anywhere (no Google Maps API key configured; every location is a plain `mapLink()` → `google.com/maps?q=lat,lng` URL); GPS "periodic" tracking is inherently foreground-tab-only in a browser SPA (no service worker); geocoding is a free best-effort service, not pinpoint-accurate. These limitations are meant to be surfaced explicitly to the user, not hidden.
- **Keep the interface simple** — many of Technet's technicians are not highly technical. Prefer extending existing UI surfaces over adding new ones (see §7a — the two-check-in mistake is the cautionary example).
- Prisma migrations: `prisma migrate dev` can hang indefinitely in this non-interactive shell environment (it waits on an interactive prompt with no stdin attached). If it hangs, kill it and instead hand-write the migration SQL file under `prisma/migrations/<timestamp>_<name>/migration.sql` following the existing folder convention, then apply with `prisma migrate deploy` (non-interactive), then `prisma generate`.
- **Client typecheck**: `client/tsconfig.json` is a TypeScript project-references root (`"files":
  []`, references to `tsconfig.app.json`/`tsconfig.node.json`). Plain `npx tsc --noEmit` from
  `client/` checks *nothing* and silently reports zero errors regardless of real type errors — it
  only validates the reference graph. Always use `npx tsc -b --noEmit` (matches `package.json`'s own
  `"build": "tsc -b && vite build"`). Discovered 2026-08-27 when a plain `tsc --noEmit` reported clean
  after removing an exported type that two other files still imported. `server/tsconfig.json` is a
  normal single-project config — plain `tsc --noEmit` there is unaffected and fine.
- **A raw-fetch scratch script isn't sufficient verification for a new client-facing numeric field**:
  a scratch script hand-typing a real JS number (e.g. `percentage: 60`) will pass even if the actual
  client code never converts its controlled `<input>`'s string value before sending it — TypeScript
  won't catch this either if the field is typed `string` end-to-end. Found 2026-08-27: the payment-
  terms-lines rework's percentage field was silently rejected by every real submission from the New
  Quotation screen (`Number.isFinite()` doesn't coerce strings) despite the scratch script and `tsc -b`
  both passing clean. Only a real Playwright run that fills the actual form and submits it caught it.
  For any new numeric field reachable from a form, run the Playwright check against the real form, not
  just a raw-fetch script with hand-typed correct types.
- **PDF/file download buttons must use fetch-with-credentials + blob, never a plain cross-origin `<a href target="_blank">`** (fixed 2026-08-25 across Quotation PDF, Invoice PDF, and both Technet Connect portal PDF links — `c303302`, `93633f1`, `4814a1e`, `5bc9272`). Root cause: prod auth cookies are `SameSite=None; Partitioned` (see §3/§6), and a Partitioned cookie set while the top-level browsing context is the client origin is *not* sent on a direct top-level navigation to the server's own origin (that creates a different partition). A plain link straight to the API 401s in prod even though the user is logged in. `fetch(url, { credentials: 'include' })` from inside the client page keeps the top-level context on the client origin, so the cookie is sent correctly — then build a blob URL and trigger the save via a synthetic `<a>` click. Apply this pattern to any *new* download/export button that hits the API directly.
- **Customer portal login must match email case-insensitively and trim both fields** (fixed
  2026-08-27, `server/src/routes/portalAuth.ts`). Symptom reported by the user: "customer uses their
  password once or twice then it says invalid email or password" — the portal login lookup was an
  exact-match `findUnique({ where: { email } })` with no trimming, even though the grant endpoint
  (`customers.ts`) already trims the email at write time. A customer typing their own email in a
  different casing than what staff had on file, or a stray space from copy-pasting the shared
  credentials, silently failed the lookup and returned the exact same generic "Invalid email or
  password" as a genuinely wrong password — indistinguishable to the customer, and the reason staff
  kept having to revoke and re-grant access instead of the original credentials just working. Fixed
  by matching email via `mode: "insensitive"` + `.trim()`, trimming the submitted password before
  `bcrypt.compare` (safe — the generated password's base64url alphabet never contains whitespace),
  and lowercasing new emails at grant time going forward. No prior code was silently resetting the
  password on its own — checked every write site to `CustomerPortalUser.passwordHash` first.

## 10. Sales/Finance — Quotation intake, rework, and Follow-Up (2026-08-25)

Driven by a manager-meeting brief walking through the live quotation screens field by field — saved
to memory as `project-tede-quotation-rework-brief-20260825`. Five items; item 1 (Finance gaining
`CUSTOMER_MANAGE_ROLES` alongside Sales/Admin — see §6) and items 2-4 below are done. **Item 5,
linking Invoice generation to a Quotation's payment terms, is deliberately not built yet** — the
brief itself flagged it as the biggest unknown, needing its own scoping pass once Invoice's current
shape (still zero relation to `Quotation`) is worked through. Don't assume it exists.

The first build pass was checked against a *summarized* brief of the meeting, not the raw transcript
— a 2026-08-26 re-check against the actual recording/transcript (two WhatsApp voice notes) caught one
real gap that summary had dropped: `Quotation.contactPerson`, explicitly asked for ("Then we will
have the contact person") and assumed to exist by the Follow-Up module ("normally we will talk to
the contact person specified in the quotation"). Now built — pre-filled from the customer's name on
create, editable on the Detail page, and used as the Follow-Up call log's default "spoken to."
**Lesson**: when a summarized brief is the only source available, treat it as provisional and
re-verify against the original recording/transcript if it's ever supplied — a summary can drop a
requirement without either party noticing.

- **Quote Request intake** (`QuotationRequest`, extended not replaced): a request can now arrive two
  ways — a customer submitting via the portal (`source: PORTAL`, auto-set, unchanged from Technet
  Connect) or staff manually logging a phone/email/referral call (`POST
  /api/quotations/quote-requests`, `SALES_ROLES`-only, new "Log a Request" modal on the Quote
  Requests tab). Manual requests may have no linked `Customer` yet — `customerId` is nullable, with a
  free-text `companyName` fallback; converting such a request into a real `Quotation` requires
  supplying a `customerId` at convert time (`Quotation.customerId` itself is still required, never
  nullable). Queue **visibility** is `QUOTE_REQUEST_VIEW_ROLES` (ADMIN, SALES_OFFICER,
  OPERATIONS_MANAGER — Operations Managers can see it but not convert/decline), while creating,
  converting, and declining stay `SALES_ROLES`-only.
- **Quotation numbers are now server-generated**, not typed by staff: `Q<YYYYMMDD>-NN`, a counter
  that resets each day (`server/src/lib/quotationNumber.ts`, `generateQuotationNumber()` + a
  catch-and-retry loop on unique-constraint collision — no dedicated sequence table, since real
  volume is a handful of quotations a day). The `status` field is no longer exposed on the New
  Quotation creation screen (always starts `DRAFT`) — status is now driven from the Follow-Up panel
  instead (see below).
- **Payment terms** (`Quotation.paymentTerms`, enum `FULL_ON_CONFIRMATION` / `SPLIT_60_40_20` /
  `SPLIT_50_50`) and **product-order availability** (`availabilityStatus` IN_STOCK/ORDER_PENDING +
  `orderDays`, both nullable/optional — not applicable to pure service/install quotations) are new
  fields, selected on the create form. Line items themselves needed **no schema change** — they were
  already a fully generic description+qty+price row (`SalesLineItemsEditor.tsx`), so "Labor" and
  "Transport" are just quick-add buttons pre-filling a row's description, not a new concept.
- **Attachments**: `Document` gained an optional `quotationId` link (mirrors the existing
  `projectId`/`customerId` pattern exactly) and a new `QUOTATION` `DocumentCategory` value. Shown on
  the Quotation Detail page's Attachments panel, reusing the existing 15MB base64-data-URL upload
  path — no new upload mechanism.
- **"Email Customer"** (Quotation Detail page): downloads the PDF as a blob then opens a prefilled
  `mailto:` link. **Deliberately not one-click send** — a `mailto:` link cannot auto-attach a file
  from a browser for security reasons, so the UI copy states plainly that the downloaded PDF must be
  attached manually. Don't build or describe this as automated sending.
- **Follow-Up of Quotation** (new `QuotationFollowUp` model + panel on Quotation Detail, new
  `/dashboard/erp/finance/follow-up` browse page): call-history log (date, who was spoken to, an
  `outcome` — deliberately a validated free `String`, not a DB enum, since the office expects this
  list to grow; see `QUOTATION_FOLLOWUP_OUTCOMES` in both `server/src/routes/quotations.ts` and
  `client/src/lib/api.ts`, kept in sync manually like the role groups). The brief's
  Approved/Not-Approved/In-Progress concept **reuses the existing `Quotation.status` enum** rather
  than adding a duplicate field (a deliberate choice, confirmed with the user) — DRAFT/SENT both
  display as "In Progress," ACCEPTED as "Approved," REJECTED as "Not Approved." The old generic
  status-dropdown panel on Quotation Detail was replaced with explicit Mark as Sent / Mark Approved /
  Mark Not Approved / Mark Expired buttons (same `PATCH` + `ALLOWED_TRANSITIONS` state machine
  underneath — SENT can only follow DRAFT, so a quotation can't be "approved" before it's sent) plus a
  `poReference` free-text field recording confirmation/PO receipt.
- A real gap found and fixed during verification: converting a Quote Request used to leave the
  Quotations tab showing a stale list (it only loads once on mount) — the new quotation was invisible
  until a manual refresh. Fixed by navigating straight to the new quotation's own detail page after a
  successful convert, instead of returning to the tab.
- **Editing a Draft quotation** (added 2026-08-26, after real user testing hit this): customer, VAT
  rate, payment terms, availability, and line items are all editable via an "Edit" button on the Line
  Items panel — but the server rejects changes to those specific fields once the quotation is no
  longer `DRAFT` (title/contact person/PO reference/status stay editable regardless). `PATCH
  /api/quotations/:id` recomputes `subtotal`/`vatAmount`/`total` server-side whenever `items` or
  `vatRate` change, same formula as creation — the client never computes/sends totals itself.
- **Item numbering + per-line totals** (added 2026-08-26): the line-item editor, the Quotation Detail
  table, and the shared PDF item table (`server/src/lib/pdf/shared.ts`, also used by Invoice PDFs) all
  show a numbered `#`/`No.` column and a computed Total Amount per row. The description field is a
  `<textarea>`, not a single-line input, so multi-line/bulleted descriptions (model numbers, specs)
  are supported end to end — verified by actually rendering a generated PDF to PNG (via
  `pdf-to-png-converter`, since no PDF rasterizer is installed locally) rather than trusting the byte
  output; this caught a real layout bug (the "Item No." header label was too wide for its column and
  wrapped, overlapping the row below) before it shipped.
- **Quotation Registry filtering** (added 2026-08-26): search (quotation number/title/customer),
  customer, status, and date-range filters above the table, live-filtered like the Work
  Orders/Intervention Reports filter row (no submit button) rather than Inventory's search-button
  pattern — status/date support already existed server-side from the rework but wasn't exposed in the
  UI; text search and customer filtering are new.
- **PDF rebuilt to match the real Technet letterhead** (added 2026-08-27, `server/src/lib/pdf/`): the
  user supplied an actual issued quotation PDF as the reference. This surfaced a real, pre-existing
  bug independent of styling — `company.ts`'s address was simply wrong ("Pont St Louis" instead of
  "Avenue St Vincent de Paul, Les Pailles 11221, Mauritius"), and since `COMPANY`/`drawLetterhead` are
  shared, this had been wrong on every Invoice PDF too, not just Quotations. Also fixed: BRN/VAT field
  order, missing website line, ordinal date formatting ("27th August"), a dynamic "Terms of payments"
  row on Conditions of Sale that now reads the quotation's real `paymentTerms` (previously hardcoded
  to 60/40 regardless of what was actually selected), and the cover-letter greeting now uses
  `contactPerson` for "Dear [FirstName]," instead of a generic "Dear Sir/Madam,". New
  `drawBoxedItemsTable`/`drawKeyValueTable` in `shared.ts` render the BOQ and Conditions-of-Sale
  sections as actual bordered tables (quotation-only — Invoice keeps the older
  `drawItemsTable`/`drawTotals` pair, which still renders correctly, just not reference-matched since
  no real invoice sample was supplied). Verification method worth remembering: this repo has no local
  PDF rasterizer, so `npm install --no-save pdf-to-png-converter` inside `pw-check/` renders a
  generated PDF to actual PNGs for visual comparison — caught a real bug this way (`drawFooterBanner`
  drawing text past the bottom margin silently triggered PDFKit's auto-pagination, inserting a blank
  page after every page; fixed by zeroing `doc.page.margins.bottom` during that one draw call).
- **PDF reworked again against a real issued quotation** (2026-08-25, `f43aa4a`): the 2026-08-27 rebuild
  above was checked against a company address only, not a full real document — this pass used an actual
  issued Technet quotation PDF the user supplied and closed several real gaps: the logo was upgraded
  from a small icon to the full "TECHNET ENGINEERING" wordmark lockup (cropped straight from the real
  PDF at high res via `pdf-to-png-converter` + `sharp` in `pw-check/`, since the icon and wordmark are
  one integrated device in the real logo — not reproducible as separate PDFKit text next to a plain
  icon); cover-letter labels (Date/Ref/To/Attn/Tel/Email) are now bold in a fixed label column instead
  of manually spaced plain strings; the BOQ and Conditions-of-Sale tables switched from a solid
  dark-cyan header fill with white text to the real template's pale-blue (`#daeef3`) header/title bars
  with black text and full per-cell grid borders (`#5fb8c9`); BOQ currency moved into the column header
  (`Unit Price (MUR)` / `Total (MUR)`) instead of repeating "MUR" on every row; and the footer banner
  recolored to the brand's actual brighter teal (`#01bbd2`) and a closer navy (`#0d5c70`). Same
  render-to-PNG verification method as before, this time compared page-by-page against the real
  reference rather than eyeballing single fields.
- **Real font embedded** (2026-08-26, `86cb3d0`): after the rework above, the user said it still didn't
  look right and pointed at the reference again — inspecting the reference PDF's own embedded fonts
  (via `pypdf`, reading each page's `/Resources/Font/*/BaseFont`) showed every real Technet
  quotation/invoice is set in **Calibri**, not Helvetica. Calibri is a proprietary Microsoft font with
  no redistributable file, so **Carlito** (a metrically-compatible, SIL-OFL-licensed drop-in fetched
  from Google Fonts as WOFF) is embedded instead via `registerBrandFonts(doc)` in `shared.ts`
  (`server/src/lib/pdf/assets/fonts.ts`, same base64-in-a-.ts-file pattern as the logo), registered as
  `"Body"`/`"Body-Bold"`/`"Body-Italic"`/`"Body-BoldItalic"` and called once per document in both
  `generateQuotationPdf` and `generateInvoicePdf` — every `Helvetica*` reference across the three PDF
  files now uses these. **Lesson for any future "make it match a real document" task**: check the
  reference file's actual embedded fonts before assuming a visual color/spacing rework is sufficient —
  font family is often the dominant fidelity gap and is easy to miss when only comparing rendered
  screenshots rather than inspecting the PDF's own internal structure.
- **Exact sizes/alignment matched against the reference** (2026-08-26, `0007909`): even with the
  right font family, colors, and rough layout, the user said it still didn't look "exactly" like the
  reference — because font *sizes* and cell *alignment* were still eyeballed guesses, not measured.
  Fixed by extracting the real numbers straight out of the reference PDF's internal layout with
  `pdfminer.six` (`pip install pdfminer.six`, then `extract_pages()` walking `LTTextLine`/`LTChar` for
  each run's actual font size and x/y position, and `LTRect` for each table cell's actual boundary) —
  a level below `pypdf`'s font-name-only introspection used in the previous fix. Found: cover letter
  body is 12pt (was guessed at 10pt), BOQ table is 11pt (was 9pt) with a title at 14pt (was 10pt), BOQ
  column proportions are 7.7/52.3/6.5/14.9/18.9% not 6/44/10/20/20% (Description is meaningfully wider,
  Qty meaningfully narrower), BOQ header labels are center-aligned not left/right, and Item/Qty/Unit
  Price/Total are vertically centered against a multi-line Description rather than top-aligned (a
  plain Word-table default). Conditions of Sales is 10pt body / 14pt title (was 8pt/11pt). **Lesson,
  sharper than the previous one**: for a "match this reference exactly" ask, don't stop at fixing the
  font family — pull the reference's real font sizes and cell coordinates via `pdfminer.six` before
  touching layout code a second time; a visual screenshot comparison alone under-detects size and
  alignment drift that's obvious once you have the actual numbers.

## 10a. Technet Digital Marketing — Phase 1 (2026-08-26)

Went from stub to built. Unlike every other module, no real manager conversation has happened for
this one yet — an earlier scoping pass (published as an artifact, not in this repo) recommended
building it in three phases, cheapest first, and this covers **Phase 1 only**: `MarketingCampaign`
→ many `MarketingPost` (title, platform, copy, scheduled date, status `PLANNED`/`POSTED`/`CANCELLED`).
No AI drafting, no auto-publish, no real platform integrations (LinkedIn/Facebook/etc. OAuth) —
Marketing plans posts here and marks them `POSTED` by hand (`POST /api/marketing/posts/:id/mark-posted`,
server-set `postedAt` so the audit timestamp isn't client-suppliable) after publishing elsewhere
themselves, same as they do today. Two decisions were confirmed with the user before building rather
than assumed:

- **Role ownership** (`MARKETING_ROLES` = ADMIN, SALES_OFFICER — see §6): nobody at Technet has
  confirmed who owns marketing. Defaulted to Sales as the closest adjacent function, same pragmatic
  pattern as `CUSTOMER_MANAGE_ROLES`. Deliberately a role-*group* array, not a new `Role` enum value —
  trivially widened later without the broad-allow-list audit a real new role would require (§6).
  Enforced two layers deep: `MarketingLayout.tsx` does an in-component `hasRole(user?.role,
  MARKETING_ROLES)` allow-list check (renders the same "This module isn't available for your role."
  `EmptyState` as `RoleRoute`, just inverted allow-vs-block logic) *inside* the existing outer
  `<RoleRoute blockedRoles={FIELD_ONLY_ROLES}>` wrapper in `App.tsx` — read access is the broader
  `NON_FIELD_ROLES` server-side (consistent with every other ERP-ish module), only writes are gated to
  `MARKETING_ROLES`.
- **Content Calendar UI**: a plain filterable table (date range/status/platform — same pattern as
  Daily Reports/Intervention Reports), *not* a calendar-grid widget. Matches this project's own
  "don't over-engineer at low volume" philosophy (originally the Operations Manager's stated
  build philosophy for a different feature, see §13's intro). Explicitly commented in
  `ContentCalendarPage.tsx` so a future session doesn't "helpfully" rebuild it as a real grid.

`platform` is a validated free string (`MARKETING_PLATFORMS` in `server/src/routes/marketing.ts`,
kept in sync with the client manually, same pattern as `QUOTATION_FOLLOWUP_OUTCOMES`), not a DB enum,
since the office may want to add platforms later without a migration. `status` *is* a real enum — a
small, stable, closed set the app logic depends on. No `ALLOWED_TRANSITIONS` table like `Quotation`
has — Phase 1 statuses have no downstream side effects to guard against yet, so transitions stay
permissive. Explicitly **not built**: any AI drafting/review step, real publishing/analytics, a
calendar-grid UI, and no new marketing-specific notification triggers (Phase 1 has no approval step
or deadline logic that obviously warrants one yet).

## 10b. Self-service leave requests for employees (2026-08-26)

Previously the entire `/api/leave` router (`server/src/routes/leave.ts`) was `HR_ROLES`-only — HR
picked an employee from a dropdown and logged a request *for* them. `EMPLOYEE`/`FIELD_TECHNICIAN`
couldn't even reach the HR Leave page (blocked by `NON_FIELD_ROLES`). Added genuine self-service:
an employee submits and can withdraw their own request; HR still reviews/approves it exactly as
before, unchanged.

- **Shared business logic extracted first**: `server/src/lib/leaveRequests.ts` now holds
  `createLeaveRequestRecord`/`cancelLeaveRequestRecord` (validation, clash detection, the
  balance-refund-on-cancel transaction) plus `parseDateOnly`/`holidaysBetween`/`leaveRequestInclude`/
  `syncEmploymentStatuses`, all moved out of `leave.ts` as a pure extraction (HR-facing
  behavior/responses unchanged). Both the HR route and the new self-service route call the same
  functions, so clash-detection and balance-refund logic can't quietly drift apart between the two
  entry points.
- **New router** `server/src/routes/myLeave.ts`, mounted at `/api/my-leave`. `requireAuth` only —
  deliberately **no role restriction**, since taking leave isn't tied to any specific role (an HR
  Officer needs to request their own leave too, not just field staff). Every route resolves the
  caller's own `Employee` via `prisma.employee.findUnique({ where: { userId: req.user!.sub } })`,
  403 "No employee record is linked to your account" if unlinked — same helper pattern and message
  already established in `siteAttendance.ts`, reused verbatim for consistency.
- **Scope is deliberately create + cancel(withdraw) only, no edit-in-place** — matches this project's
  established anti-over-engineering bias; withdrawing and resubmitting covers mistake-correction
  without a second edit code path to validate. Cancelling only works while `status === PENDING`
  (`restrictToEmployeeId` on `cancelLeaveRequestRecord` also enforces ownership — 404, not 403, if a
  request isn't the caller's own, matching the "don't reveal existence" pattern used elsewhere).
- Submitting notifies HR (`notifyRoles(HR_ROLES, "LEAVE_REQUEST_SUBMITTED", ...)`, new
  `NotificationType` value + migration `20260826100000_leave_request_submitted_notification`) — same
  "something needs review" pattern as requisitions/quotations/maintenance requests.
- **Client**: new top-level page `client/src/MyLeavePage.tsx` (alongside `SettingsPage.tsx`, not
  nested under ERP) at `/dashboard/my-leave`, added to `App.tsx` **outside** the
  `<RoleRoute blockedRoles={FIELD_ONLY_ROLES}>` wrapper so field-only roles can reach it, and to
  `nav.ts`'s `MAIN_NAV` right after Overview with no `hiddenFrom` — visible to every role. Guards on
  `!user?.employeeId` with the same "contact HR" `EmptyState` used elsewhere for unlinked accounts.
- **Verified 2026-08-26**: server logic via a disposable scratch script (HR flow regression, self-
  service create/list/cancel, HR notification fires, unlinked-user 403) and the full browser flow via
  Playwright (submit → PENDING badge → withdraw → CANCELLED badge, toast confirmations). The first
  Playwright pass showed the withdraw step failing (status stuck on PENDING) — turned out to be a
  **test-script false negative**, not an app bug: the script used a fixed `waitForTimeout` after
  submitting, but the create `POST` sometimes takes longer than that on a cold Neon connection (see
  §9's Neon cold-start note), so the later assertions raced ahead of the request actually landing.
  Fixed by waiting on the actual network response (`page.waitForResponse`) instead of a fixed delay;
  re-run passed cleanly. **Lesson for next time**: any Playwright check against this app that follows
  a create/submit action should wait for the real response, not a fixed timeout — a fixed delay that
  "usually" works will intermittently produce a false FAIL on a cold connection.

## 10c. ERP Overview reflects the whole ERP umbrella, not just Finance+Inventory (2026-08-26)

Don't confuse this with the top-level dashboard Overview (`/dashboard`, §5's intro) — this is the
**ERP-scoped** landing page, `/dashboard/erp` ("Engineering Dashboard", `client/src/TechnetErpPage.tsx`).
It previously only showed Finance/Sales (customers, quotations, invoices, contracts) and Inventory
(low stock) — Procurement, HR, Projects, and Documents are all fully built modules but were invisible
here, even though the page is meant to represent the whole **Technet ERP** umbrella (§5). Extended to
pull real data from all of them: a second stat-card row (Active Projects, Pending Requisitions, Open
Purchase Orders, Active Headcount), an Active Projects table + Requisitions Awaiting Approval panel,
and Recent Activity now also surfaces requisition submissions, PO creation, project creation, and
document uploads (previously only customers/invoices/quotations/low-stock).

**RBAC finding worth remembering for future dashboard work**: every list/GET route this page reads is
gated only at the broad `NON_FIELD_ROLES` level (the same gate that protects reaching `/dashboard/erp`
at all) — narrower groups like `FINANCE_ROLES`/`PROCUREMENT_ROLES` only restrict *writes*, not reads.
This was already true of the original page (a Storekeeper could always see Finance revenue here
without a role check) and turned out to also be true of Procurement/Projects/Documents/Employees, so
none of the new data needed new role-gating. **The one exception**: `leave.ts` (and `certifications.ts`,
not used here) really is `HR_ROLES`-only server-side even for reads, so the one new leave-derived card
("Leave Pending Approval") is fetched only when `hasRole(user?.role, HR_ROLES)`, the same client-side
gate `client/src/erp/hr/HrOverviewPage.tsx` already uses — non-HR roles simply don't get that 9th
stat card, no error, no placeholder.

## 10d. Quotation walkthrough addendum — Call Log, payment terms, validity, Product Line (2026-08-27)

A live walkthrough of the quotation screens (manager + two staff, one new to the process) produced a
follow-up brief to §10. Cross-checked against the **full meeting transcript**, not just a summary, per
the lesson in §10's own intro — confirmed nothing was dropped and caught one addition (per-call
accountability) the written brief's paraphrase didn't fully capture. Ground-truth check before
building: the manager saying the Quote Request screen "doesn't exist" was inaccurate — it's fully
built (§10) — what was actually missing was the SLA/acknowledgement/note layer described below.

- **Call Log** (the Quote Requests tab, relabeled to match how the manager actually refers to it —
  route/component/API names unchanged, display-only rename in `QuotationsPage.tsx`/
  `QuoteRequestsTab.tsx`): `QuotationRequest` gained `loggedById` (auto-set from `req.user!.sub` at
  creation, not user-entered — null for portal-submitted requests since no staff member "answered"
  those; filterable via a staff dropdown, same unfiltered-options-fetch pattern as Assets' Category
  filter, §7c), `statusNote` (free-text, editable anytime while `PENDING`, visible inline on the list
  so a manager checking after-hours doesn't have to call and ask why something's pending), and the
  acknowledgement-email trio `ackEmailBody`/`ackDraftSavedAt`/`acknowledgedAt` (a pre-filled template,
  Save Draft vs Send — Send both persists `acknowledgedAt` and reuses the existing `mailto:` handoff
  pattern from `QuotationDetailPage.tsx`'s "Email Customer", since this app has no real backend email
  sending anywhere). The 24h response SLA has **no stored deadline** — it's computed at read time
  (`createdAt + QUOTE_REQUEST_SLA_HOURS`, a named constant in `quotations.ts`, not a settings-table
  value — confirmed with the user rather than building this app's first general admin-settings system
  for one number). Overdue = `status === 'PENDING' && !acknowledgedAt && past the deadline` —
  converting or declining a request already counts as "responding," independent of acknowledgement.
  No cron/notification was added for the overdue flag; it's read-only, matching this app's existing
  "computed on view" pattern (§7a's certification-expiry logic) rather than new infrastructure.
- **Payment terms**: replaced the old fixed 3-preset enum (100% / 60-40-20 / 50-50) entirely with a
  repeatable `QuotationPaymentTermsLine` table (label + percentage, must sum to 100) — the manager's
  own example ("what if there is another split and it does not appear in the dropdown") made a fixed
  set of presets untenable. Migration backfills every existing quotation's enum value into equivalent
  rows before dropping the column/enum. Label control resolves an open question the manager raised
  and explicitly did not settle himself (data-quality risk of free-typed labels vs. wanting to move
  fast) — **confirmed with the user**: everyday quotation creation picks from previously-used labels
  (a floor list unioned with whatever's already in the DB, no separate lookup table), only `ADMIN` can
  introduce a genuinely new one. The PDF's "Terms of payments" row now lists each line instead of one
  of three fixed sentences (`paymentTermsDescription()` in `company.ts` reworked accordingly).
- **"Expires" → "Validity"**: the on-screen date field and the PDF's static "Validity: 15 Calendar
  days" text were two disconnected things — confirmed by grep, the PDF never actually read the
  `expiresAt` field at all. Replaced with `validityDays Int @default(15)` (a real duration, not an
  absolute date — FX risk is why the office thinks in "valid for a period," not an expiry date; 15
  preserves what every historical quotation already prints). The PDF's Validity row now reads it.
- **Product Line**: new `Quotation.productLine` (nullable string, small fixed allow-list — Air
  Conditioning Unit/Plumbing/Electrical/Tools/Other), internal-only, **never** rendered in the PDF.
  `Title` was deliberately left untouched — the manager floated renaming/repurposing it mid-meeting,
  then walked it back once reminded Title is what actually appears in the printed quotation. The
  linked product/model autocomplete this field is meant to eventually power is **explicitly deferred**
  ("not now... just for the sake of conversation, at the back of your mind" — the manager's own
  words) — don't build the lookup/autocomplete without being asked again.
- **Small fixes**: `registerBrandFonts()` in `shared.ts` was re-decoding all 4 base64 Carlito font
  strings on every single PDF request — now module-level constants like `LOGO_BUFFER` already was.
  `GET /:id/pdf`'s two independent DB lookups (quotation, signatory user) switched from sequential
  `await`s to `Promise.all`. Both are real, small wins — the dominant contributor to the "PDF takes
  time to download" complaint is almost certainly Neon cold-start latency (§9), an existing accepted
  tradeoff elsewhere in this app, not fixed in this pass. **Logo swap is still outstanding** — blocked
  on the user supplying the current logo file; do it as a quick follow-up once received.
- **Post-save navigation**: saving a new quotation used to just close the modal and silently reload
  the list. Now navigates straight to the new quotation's detail page (same fix already applied to the
  quote-request conversion flow) with a toast that says "saved as draft," and the Draft-only Edit
  button on Line Items gets a one-line hint explaining its actual scope (customer/terms/items, not
  just line items).
- **A real bug this work surfaced, not a test artifact** — see §9's new bullets on `tsc -b` and why a
  raw-fetch scratch script isn't sufficient for a new numeric field: the payment-terms percentage was
  silently rejected on every real submission until caught by an actual Playwright run against the real
  form.

## 11. SDD vs. actual implementation — known divergences

The SDD (see §1) describes a *proposed* design from an internship research effort; this repo is the real, independently-evolved implementation. Treat the SDD as background/rationale, not a spec to conform to. Known gaps, as of 2026-08-19:

- **Backend/auth**: SDD proposes JWT + OAuth 2.0, Redis caching, AWS S3/Azure Blob for documents, Google Maps API for GPS, 8 separate PostgreSQL schemas. Actual: JWT-only in an httpOnly cookie (no OAuth 2.0, no Redis), documents stored as DB `Bytes` columns (not cloud storage), free OpenStreetMap Nominatim for geocoding (not Google Maps — a deliberate cost tradeoff, see [[feedback-geocoding-provider-choice]]), and a single default Postgres schema (not split by domain).
- **Mobile**: SDD proposes a React Native mobile app for technicians (struck through/crossed out in the SDD's own tech stack table on p.28-29, suggesting it was already being deprioritized during the SDD's own authoring). Actual: no native/React Native app exists — field technicians use the responsive web client.
- **AI features**: SDD describes an AI quotation assistant and AI-assisted marketing content generation via OpenAI/Azure OpenAI. Actual: no AI integration exists yet anywhere in the app. Technet Digital Marketing's Phase 1 (campaigns + content calendar, see §10a) is now built, but deliberately has no AI — that's Phase 2, not yet started.
- **Email-based quotation intake**: SDD describes parsing inbound customer emails into quotation requests (§2.7.1, §5.14.1) as a deliberate channel alongside the portal, with indicative per-email costs discussed. Not implemented, and not planned — Technet Connect (built 2026-08-24, see §5) covers portal-submitted quote requests only, a simpler form-based flow, not inbound email parsing.
- **Attendance machine integration**: SDD's Workforce module centers on syncing the existing facial-recognition attendance machine. Actual: "Attendance Sync" is still a decorative stub tile; office attendance is a separate manual `AttendanceRecord` HR feature, distinct from the GPS-based `SiteAttendance` system that Operations actually uses (see §7a) — the SDD's Attendance Sync and this repo's GPS site attendance are two different things with similar names, don't conflate them.
- **RBAC granularity**: SDD's role list (Chapter 1, 6) includes Managing Director as a distinct role from Administrator, plus a Customer role. Actual `Role` enum (§6 above) has no separate Managing Director role — ADMIN covers that ground. Customer auth does now exist (built 2026-08-24) but deliberately as its own separate domain rather than a value in the internal `Role` enum — see §6.
- **Module naming**: what the SDD calls "Technet Workforce" (attendance sync + leave + payroll) is now closer to reality as of 2026-08-20 — Workforce holds Availability + Attendance + Payroll, ERP HR keeps Employees/Leave/Certifications. Still diverges from the SDD in one way: there is no real biometric/facial-recognition attendance-machine sync (see the Attendance Sync line above) — Workforce's Availability view is built on the existing manual attendance register, not a machine feed.

If a future task references something from the SDD (a specific API path like `/api/v1/quotations/{id}/approve`, a table/column name, a security control), verify it against the actual code first — the SDD was written independently and predates or idealizes parts of what's actually built.

## 12. Where to look for more history

- `git log --oneline` in the repo root — 173+ commits from 2026-07-20 to present, one logical change per commit with descriptive messages (per the convention above), effectively a full changelog.
- The auto-memory system (Claude-side, not in this repo) tracks: commit-granularity feedback, the GPS-attendance feature's evolving architecture, the deliberate geocoding-provider choice, the SDD's location and divergences from actual implementation (§11), and — as of 2026-08-19 — a manager-meeting brief covering intervention report search/breakdown, field-entry friction, attendance-trust confirmation, and offline/PWA scoping, actively being worked through starting 2026-08-20. This document folds their content in where practical, but they may have been updated further since this file was last written — check memory for anything time-sensitive.

## 13. Active work as of 2026-08-20 — manager-meeting follow-ups

Two briefs (both under `C:\Users\User\Downloads\`) drove this work: `claude-code-brief-manager-meeting-2026-08-19.md` and its companion `claude-code-brief-pwa-offline.md`. Manager's stated build philosophy, treated as a hard constraint: intervention volume is single digits now (~5-7 near-term) — a 2-day manual workaround beats a 2-3 month automated build at this volume; don't over-engineer. Status as of 2026-08-20, in the brief's original priority order:

1. **Field-entry duplication** — ✅ Done. Real issue was Daily Report ↔ Intervention Report disconnected free-text summaries, not the paper-form-photo field (initial hypothesis, corrected by the user). Daily Reports now surface same-day intervention reports for the selected work order with a one-click "Insert" into the Summary field. (`6d546a9`)
2. **Attendance-trust confirmation** — ✅ Done. Existing GPS system (§7a) already covered the manager's stated need; the one real gap — supervisor-initiated, on-demand location check (previously technician-initiated only) — was built as a "Request location check" button on Field Operations, sending a notification asking the technician to verify (not a live/forced ping — kept honest in the UI copy). (`7aaa461`, `72246e1`, `85da9c3`, `27fe2ac`)
3. **Intervention search/audit by client** — ✅ Done. Customer + date filters and CSV export already existed and worked; added quick 3/6/12-month range buttons and a visible result count for faster phone-call lookups. (`9f484b5`) Sub-location structured field (e.g. "Level 5") question raised with the user — decision: stay on free text, no schema change.
4. **Per-unit problem/action breakdown** on `InterventionReport` — ✅ Done. New `InterventionReportUnit` model (label/problem/action rows, cascade-deleted with the report), an opt-in `UnitBreakdownEditor` on the report form, and a matching display block on the detail page. (`7ce2969` through `b519f56`)
5. **Offline save + auto-sync** — ⏳ Not started. PWA install (Part 1, low-risk) should ship before offline field-flow support (Part 2). Blocked on the manager confirming exact offline scope needed (check-in only vs. full report+photo submission vs. viewing-only) before any queue/sync code is written — do not guess this one.
6. **Parallel-team visibility** — ✅ Done. Field Operations now groups technicians under one job header when several share a work order, instead of scattering them as unrelated rows. (`eb509a0`)
7. **OCR/scan ingestion** — Parked by the manager as a contingency only. Not built, not planned.
