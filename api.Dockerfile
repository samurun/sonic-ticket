# --- deps: resolve workspace deps with pnpm ---
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Copy manifests first so dep install is cached independently of source changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile --filter=api...

# --- runtime: Bun executes TypeScript source directly ---
FROM oven/bun:1 AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/redis/node_modules ./packages/redis/node_modules

COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/redis ./packages/redis
COPY packages/typescript-config ./packages/typescript-config
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["bun", "run", "src/index.ts"]
