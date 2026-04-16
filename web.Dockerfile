# --- deps: resolve workspace deps with pnpm ---
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Copy manifests first so dep install is cached independently of source changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/redis/package.json ./packages/redis/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile --filter=web...

# --- builder: compile Next.js ---
FROM deps AS builder
COPY apps/web ./apps/web
COPY apps/api ./apps/api
COPY packages/ui ./packages/ui
COPY packages/db ./packages/db
COPY packages/redis ./packages/redis
COPY packages/typescript-config ./packages/typescript-config

# NEXT_PUBLIC_* is baked at build time, so it must be a build arg
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter=web build

# --- runtime ---
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

COPY --from=builder /app ./

WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
