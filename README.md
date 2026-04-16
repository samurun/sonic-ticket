# Sonic Ticket

High-throughput ticket reservation system.

## Requirements (SLA)

- ต้องสามารถ reserve ticket 500 ใบได้ภายใน 2 วินาที (≈ 250 reservations/sec sustained)
- ต้องรองรับ concurrent users มากกว่า 5,000 คน

ตัวเลขนี้เป็นตัวกำหนดสถาปัตยกรรม — Postgres `SELECT ... FOR UPDATE` บน row เดียวรองรับได้ราว ~100 tx/s เท่านั้นเมื่อมี contention สูง จึงต้องใช้ Redis เป็น hot path สำหรับ seat inventory

## Architecture approach

1. **Redis เป็น seat inventory ช่วงขาย** — pre-load จำนวนที่นั่งจาก Postgres เข้า Redis ตอนเปิดขาย ใช้ atomic `DECR` หรือ Lua script กัน oversell
2. **Reservation TTL** — จองสำเร็จ → ตั้ง key `reservation:{userId}:{eventId}` พร้อม TTL 5-10 นาที หาก user ไม่จ่ายจะ auto-release
3. **Postgres เป็น durable ledger** — worker consume จาก queue (BullMQ / Redis Stream) เขียน final state ลง DB แบบ async ไม่อยู่ใน request path
4. **Waiting room / rate limit** ด้านหน้า — กัน spike เกิน capacity ก่อนถึง Redis

## Stack

Monorepo (pnpm + Turborepo):

- `apps/web` — Next.js 16 (App Router, React 19, Turbopack)
- `apps/api` — Elysia บน Bun runtime + OpenAPI plugin
- `packages/ui` — shadcn/ui component library (shared)
- `packages/eslint-config`, `packages/typescript-config` — shared configs

Infra: Postgres 16, Redis 8, RedisInsight v2 (ทั้งหมดใน `docker-compose.yml`)

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # ตั้ง DB_*, REDIS_*, REDISINSIGHT_PORT, APP_PORT
docker compose up -d                      # postgres + redis + redisinsight
pnpm dev                                  # web + api พร้อมกัน
```

รัน workspace เดียว: `turbo dev --filter=web` หรือ `turbo dev --filter=api`

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | รัน web + api ใน watch mode |
| `pnpm build` | build ทุก workspace |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Prettier |

## Adding shadcn components

รันจาก repo root โดย target ไปที่ `apps/web` — ไฟล์จะถูกวางใน `packages/ui/src/components/`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import ใช้งาน:

```tsx
import { Button } from "@workspace/ui/components/button"
```
