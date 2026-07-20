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

## Deployment (Cloudflare-based)

Cloudflare's edge runtime (Workers/Pages Functions) is not Node.js, so Express cannot run there directly. The recommended split:

| Piece | Where | Notes |
|---|---|---|
| **Client** (`client/dist`) | Cloudflare Pages | Static React build, deploy via `wrangler pages deploy client/dist` or Git integration |
| **Server** (Express API) | A Node host — Render, Railway, Fly.io, or a VPS | Set `DATABASE_URL` and `CLIENT_ORIGIN` (your Pages URL) as env vars there |
| **Database** | Neon or Supabase (Postgres) | Both have generous free tiers and give you the `DATABASE_URL` to use above |
| **DNS/CDN** | Cloudflare | Point your domain at Cloudflare, proxy `api.yourdomain.com` to the Node host and the root domain to Pages |

If full Cloudflare-only hosting becomes a requirement later, the API would need to be rewritten with [Hono](https://hono.dev) (an Express-like framework that runs on Workers) instead of Express, paired with Cloudflare D1 as the database.

## API

- `GET /api/health` — health check, returns `{ status, uptime }`
