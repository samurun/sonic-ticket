# Stage 1: Install dependencies
FROM oven/bun:1 AS base
WORKDIR /app

# Stage 2: Install production dependencies
FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Stage 3: Release
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

# Run as non-root user for security
USER bun
EXPOSE 4000
ENTRYPOINT ["bun", "run", "src/index.ts"]