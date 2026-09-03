# Technet Digital

Monorepo for the Technet Enterprise Digital Ecosystem.

## Stack

- **Client:** React 19 + TypeScript, built with Vite
- **Server:** Node.js + Express 5 + TypeScript
- **Database:** PostgreSQL via Prisma ORM (7.x, uses the `@prisma/adapter-pg` driver adapter)
- **Dev orchestration:** npm workspaces + `concurrently`

## Project structure

```
Technet Digital/
├── client/       React app (Vite)
├── server/       Express API
│   ├── src/
│   │   ├── index.ts       app entry point
│   │   └── lib/prisma.ts  Prisma client instance
│   └── prisma/
│       └── schema.prisma  database schema
└── package.json  root workspace config
```

## Getting started

Install everything from the repo root (installs both workspaces):

```bash
npm install
```

### Environment variables

Copy `server/.env.example` to `server/.env` and fill in a real Postgres connection string:

```bash
cp server/.env.example server/.env
```

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://user:password@host:5432/technet_digital?schema=public"
```

### Run in development

From the repo root, runs client (Vite, :5173) and server (Express, :4000) together:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:client
npm run dev:server
```

### Database

After setting `DATABASE_URL`, apply the schema:

```bash
cd server
npm run prisma:migrate   # creates/updates tables from prisma/schema.prisma
npm run prisma:studio    # optional: browse data in a GUI
```

### Build for production

```bash
npm run build
```

Builds the client to `client/dist` and compiles the server to `server/dist`.

## Deployment

Everything runs on free tiers. Cloudflare's edge runtime is not Node.js, so Express
can't run there — the API needs a real Node host.

| Piece | Where | Live at |
|---|---|---|
| **Client** (`client/dist`) | Cloudflare Workers | `technet-digital.technetprojectassistant01.workers.dev` |
| **Server** (Express API) | Render (free web service) | `technet-digital-api.onrender.com` |
| **Database** | Neon (free Postgres) | — |

### Client

Built and deployed by `.github/workflows/deploy-client.yml` on every push to `main`
that touches `client/**`. The job runs `npm run deploy` (`vite build` then
`wrangler deploy`); `client/wrangler.jsonc` sets the SPA fallback so client-side
routes resolve.

`VITE_API_URL` is set in that workflow's `env:` block and is **baked in at compile
time**, not read at runtime — changing the API's address means editing the workflow
and re-running it, not flipping a setting on Cloudflare.

### Server

`render.yaml` is a Render Blueprint (New → Blueprint → pick this repo). It builds
from the repo root rather than `server/`, because npm workspaces needs the root
`package.json` and lockfile to resolve the server's dependencies.

`npm run start -w server` runs `prisma migrate deploy` before booting, so schema
changes apply on each deploy.

`CLIENT_ORIGIN` is committed in `render.yaml`. The rest are marked `sync: false`
and get set in the Render dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Neon **direct** (non-pooled) connection string |
| `JWT_SECRET` | Any long random string — **rotating it logs every user out** |
| `RESEND_API_KEY` | From Resend, for password-reset email |
| `EMAIL_FROM` | The verified sender address |

Use Neon's direct URL, not the pooled one: `prisma migrate deploy` takes advisory
locks that Neon's connection pooler doesn't support, so migrations fail on the
pooled URL.

`CLIENT_ORIGIN` and `VITE_API_URL` point at each other. If either is wrong the app
loads but every request fails CORS, since `cors` runs with `credentials: true` and
won't accept a wildcard origin.

`railway.json` is left in the repo as historical reference from the pre-2026-08-24
Railway setup. Nothing reads it.

### Free-tier limits worth knowing

- Render free services **sleep after ~15 minutes of inactivity**; the next request
  takes roughly 30–60s while the container wakes. This looks like a hang and isn't.
- Neon auto-suspends after ~5 minutes idle (2.5–9s cold start).
  `server/src/lib/keepWarm.ts` pings it every 4 minutes while the server process is
  up, so this only bites on the first request after the API host itself has slept.
- Documents, signatures, and attachments are stored as `Bytes` columns in Postgres
  rather than object storage, so uploads count against Neon's ~0.5 GB free
  allowance. This is the limit you'll hit first. The fix when you outgrow it is
  moving attachments to object storage (Cloudflare R2 has a free tier and charges
  no egress), not a larger database.

If full Cloudflare-only hosting becomes a requirement later, the API would need to be rewritten with [Hono](https://hono.dev) (an Express-like framework that runs on Workers) instead of Express, paired with Cloudflare D1 as the database.

## API

- `GET /api/health` — health check, returns `{ status, uptime }`
