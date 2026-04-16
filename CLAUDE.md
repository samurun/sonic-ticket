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

The API uses the **Bun** runtime (`bun run --watch`), not Node. The web app uses Node + Next.js Turbopack. `pnpm` is the required package manager (see `packageManager` field, Node >= 20).

No test runner is wired up yet — `apps/api` has a placeholder `test` script that exits 1.

### Infra

```bash
docker compose up -d    # postgres, redis, redisinsight
```

All services read env from `./apps/api/.env` (including the web/UI-only vars). Redis boots with `--requirepass ${REDIS_PASSWORD}`; RedisInsight auto-connects via `RI_REDIS_*` envs and exposes on host `${REDISINSIGHT_PORT}` → container `5540` (v2 image).

### Adding shadcn components

Run from the repo root, targeting the web app, but components land in the shared UI package:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Files are written to `packages/ui/src/components/` and imported as `@workspace/ui/components/<name>`. The `components.json` in `apps/web` points shadcn's css/utils aliases at the UI package, so do not re-run `shadcn init` inside `apps/web` — it will duplicate the config.

## Architecture

Monorepo layout (pnpm workspaces + Turborepo):

- **`apps/web`** — Next.js 16 (App Router, React 19, Turbopack). Thin shell: most UI lives in `@workspace/ui`. `next.config.mjs` sets `transpilePackages: ["@workspace/ui"]` so the package ships as source TSX, not prebuilt.
- **`apps/api`** — Elysia server on Bun. Entry at `src/index.ts` mounts `@elysiajs/openapi` and listens on `APP_PORT` (default 3000, host `0.0.0.0`). Routes live under `src/modules/<feature>/` with the convention `index.ts` (Elysia plugin/route) + `service.ts` (business logic) — see `modules/health` as the reference shape for new modules.
- **`packages/ui`** — shadcn/ui component library consumed by `apps/web`. Exports are subpath-scoped (`./components/*`, `./hooks/*`, `./lib/*`, `./globals.css`, `./postcss.config`) — import from the specific subpath, never from the package root.
- **`packages/eslint-config`** — shared flat configs: `base.js`, `next.js`, `react-internal.js`. Consumers reference these via `@workspace/eslint-config`.
- **`packages/typescript-config`** — shared tsconfigs: `base.json`, `nextjs.json`, `react-library.json`, extended as `@workspace/typescript-config/*.json`.

### Cross-cutting conventions

- Workspace packages are referenced as `@workspace/<name>` with `workspace:*` versions. Adding a new internal package means a new `@workspace/<name>` entry plus a subpath export map if it ships source files (mirror `packages/ui/package.json` exports).
- Tailwind v4 lives in `packages/ui/src/styles/globals.css` and is imported by the web app; shared PostCSS config is re-exported from `@workspace/ui/postcss.config`.
- Turborepo caches `build`/`lint`/`typecheck`/`format` and treats `.env*` as part of `build` inputs. `dev` is uncached and persistent.
