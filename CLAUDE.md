# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root. Turborepo fans tasks out to workspaces.

```bash
pnpm dev          # run all apps in parallel (web + api watch modes)
pnpm build        # build all workspaces
pnpm lint         # eslint across workspaces
pnpm typecheck    # tsc --noEmit across workspaces
pnpm format       # prettier write
```

Scope a task to a single workspace with `turbo <task> --filter=<name>`, e.g. `turbo dev --filter=web` or `turbo typecheck --filter=api`.

The API uses the **Bun** runtime (`bun run --watch`), not Node. The web app uses Node + Next.js Turbopack. `pnpm@9.15.9` is the required package manager (see `packageManager` field, Node >= 20).

No test runner is wired up yet. `apps/api` has a `loadtest` script that runs [k6](https://k6.io) against the reservation flow (`apps/api/loadtest/reservation-rush.js`) — seeds itself and reports p95 per op.

### Env

A **single** `.env` lives at the repo root (`.env.example` is the template). `apps/api/.env` and `apps/web/.env` are symlinks back to root so Bun / Next / drizzle-kit all resolve one source of truth, and docker compose picks it up automatically with no `--env-file` flag.

Docker compose overrides `DB_HOST` → `db` and `REDIS_HOST` → `redis` for the in-network services; the root `.env` keeps `localhost` defaults for host-side dev.

### Infra

```bash
pnpm docker:up      # postgres + redis + redisinsight + api + web
pnpm docker:down
pnpm docker:build   # rebuild api/web images
```

Redis boots with `--requirepass ${REDIS_PASSWORD}`; RedisInsight auto-connects via `RI_REDIS_*` envs and exposes on host `${REDISINSIGHT_PORT}` → container `5540` (v2 image). The api and web images are built from `api.Dockerfile` and `web.Dockerfile` at the repo root (monorepo-aware multi-stage builds — see below).

### Adding shadcn components

Run from the repo root, targeting the web app, but components land in the shared UI package:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Files are written to `packages/ui/src/components/` and imported as `@workspace/ui/components/<name>`. The `components.json` in `apps/web` points shadcn's css/utils aliases at the UI package, so do not re-run `shadcn init` inside `apps/web` — it will duplicate the config.

## Architecture

Monorepo layout (pnpm workspaces + Turborepo):

- **`apps/web`** — Next.js 16 (App Router, React 19, Turbopack). Thin shell: most UI lives in `@workspace/ui`. `next.config.mjs` sets `transpilePackages: ["@workspace/ui"]` so the package ships as source TSX, not prebuilt. Uses TanStack Query; hooks under `apps/web/hooks/*` wrap each API call.
- **`apps/api`** — Elysia server on Bun. Entry at `src/index.ts` mounts `@elysiajs/openapi`, listens on `APP_PORT` (default 4000, host `0.0.0.0`), and starts the hold-expiry subscriber. `src/app.ts` starts the booked-sync interval and mounts routers. Routes live under `src/modules/<feature>/` with the convention `index.ts` (Elysia plugin/route) + `service.ts` (business logic) + `model.ts` (Elysia validators) — see `modules/tickets` as the reference shape.
- **`packages/db`** — Drizzle ORM + Postgres (postgres.js). Exports `db`, `sql`, and schema tables via `@workspace/db`. Schema lives in `src/schema/` and the root `src/schema/index.ts` controls what is re-exported.
- **`packages/redis`** — ioredis singleton configured from env. Imported as `@workspace/redis`.
- **`packages/ui`** — shadcn/ui component library consumed by `apps/web`. Exports are subpath-scoped (`./components/*`, `./hooks/*`, `./lib/*`, `./globals.css`, `./postcss.config`) — import from the specific subpath, never from the package root.
- **`packages/eslint-config`** — shared flat configs: `base.js`, `next.js`, `react-internal.js`. Consumers reference these via `@workspace/eslint-config`.
- **`packages/typescript-config`** — shared tsconfigs: `base.json`, `nextjs.json`, `react-library.json`, extended as `@workspace/typescript-config/*.json`.

### Tickets module (reservation hot path)

`apps/api/src/modules/tickets/` is the core flow. Any change to reservation semantics should preserve these invariants:

- **Atomic hold/confirm** — `service.ts` defines two Lua commands (`holdBooking`, `confirmBooked`) via `redis.defineCommand`. They run as single atomic units on Redis so TTL expiry cannot race the `SADD booked` step and oversell. Never replace them with multi-step client-side logic.
- **Compensating `INCR available`** — if `DECR available` goes below 0 inside `holdBooking`, the script `INCR`s back and deletes the hold. Same pattern for any future inventory operation.
- **Hold expiry → seat release** — `expiry-subscriber.ts` listens on `__keyevent@${REDIS_DB}__:expired` (enabled via `CONFIG SET notify-keyspace-events Ex` at startup) and `INCR`s available only when the user is not already in `booked` (guards against confirming-just-in-time racing).
- **Postgres is async ledger** — `booked-sync.ts` mirrors `SCARD booked` into `tickets.booked` on a timer (`BOOKED_SYNC_INTERVAL_MS`, default 10s). Keep DB writes out of the hold/confirm path.
- **Key schema** — `ticket:available`, `ticket:booked` (set), `ticket:hold:{userId}` (string with TTL). Single ticket in this demo, so no ticket id in keys.

### Cross-cutting conventions

- Workspace packages are referenced as `@workspace/<name>` with `workspace:*` versions. Adding a new internal package means a new `@workspace/<name>` entry plus a subpath export map if it ships source files (mirror `packages/ui/package.json` exports).
- Tailwind v4 lives in `packages/ui/src/styles/globals.css` and is imported by the web app; shared PostCSS config is re-exported from `@workspace/ui/postcss.config`.
- Turborepo caches `build`/`lint`/`typecheck`/`format` and treats `.env*` as part of `build` inputs. `dev` is uncached and persistent.
- Web/API type sharing: `apps/web/lib/api.ts` uses `@elysiajs/eden` treaty with `import type { App } from "api"` — so API route changes are reflected in web hooks at compile time. Don't hand-write client types.

### Docker build

`api.Dockerfile` and `web.Dockerfile` are monorepo-aware multi-stage builds at the repo root:

1. **deps** stage — `node:20-alpine` + pnpm; copies `package.json` of every relevant workspace first (layer cache), then `pnpm install --frozen-lockfile --filter=<app>...` (`...` = include transitive workspace deps).
2. **runtime** stage — `oven/bun:1` for api (runs TS directly), `node:20-alpine` for web (`next start`). Copies only the workspaces the app actually consumes; `.dockerignore` strips `node_modules`, `.turbo`, `.next`, etc.

The web Dockerfile bakes `NEXT_PUBLIC_API_URL` at build time via `ARG` — runtime-only env won't work for client bundles.
