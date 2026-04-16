# Sonic Ticket

High-throughput ticket reservation demo — ไล่ SLA 500 reservations / 2 วินาที และรองรับ concurrent users 5,000+ คน โดยใช้ Redis เป็น hot path สำหรับ seat inventory และ Postgres เป็น durable audit trail

## SLA ที่ขับสถาปัตยกรรม

- 500 reservations ภายใน 2 วินาที (≈ 250 reservations/sec sustained)
- Concurrent users 5,000+

Postgres `SELECT ... FOR UPDATE` บน row เดียวรองรับได้ราว ~100 tx/s เมื่อมี contention สูง ตัวเลขนี้ตัด Postgres-only hot path ออก — ต้องเอา inventory มาอยู่ใน Redis

## Architecture

1. **Redis = seat inventory ช่วงขาย**
   - `DECR ticket:available` atomic กัน oversell
   - Hold/confirm เขียนเป็น Lua script รันเป็น single atomic unit:
     - `holdBooking` — SISMEMBER-booked → SET-hold-NX (TTL) → DECR-available (compensating INCR ถ้า sold_out)
     - `confirmBooked` — EXISTS-hold → SADD-booked → DEL-hold (idempotent ถ้า booked แล้ว)
2. **Hold TTL 150s** — ถ้า user ไม่ confirm → Redis keyspace notification (`__keyevent__:expired`) → subscriber คืน seat โดย `INCR available`
3. **Postgres = audit trail** — background worker (ทุก 10s) sync `SCARD booked` → `tickets.booked` column ไม่อยู่ใน request path
4. **Mock payment delay** — `confirm` sleep ตาม `MOCK_PAYMENT_DELAY_MS` ก่อน promote hold → booked แสดง hold/confirm race window ชัดเจน

## Stack

Monorepo (pnpm workspaces + Turborepo):

- `apps/web` — Next.js 16 (App Router, React 19, Turbopack) + TanStack Query
- `apps/api` — Elysia บน Bun + `@elysiajs/openapi`
- `packages/db` — Drizzle ORM + Postgres schema
- `packages/redis` — ioredis singleton + connection config
- `packages/ui` — shadcn/ui component library (shared)
- `packages/eslint-config`, `packages/typescript-config` — shared configs

Infra: Postgres 16, Redis 8, RedisInsight v2 (`docker-compose.yml`)

## Getting started

```bash
pnpm install
cp .env.example .env            # ตั้ง DB_PASSWORD, REDIS_PASSWORD

# symlink ให้ apps ทั้งสองใช้ root .env เดียวกัน
ln -s ../../.env apps/api/.env
ln -s ../../.env apps/web/.env

pnpm docker:up                  # postgres + redis + redisinsight + api + web
# หรือรัน dev mode (host bun/next + docker infra เท่านั้น):
# pnpm docker:up db redis redisinsight
# pnpm dev

pnpm db:push                    # apply schema
curl -X POST http://localhost:4000/tickets/seed   # สร้าง ticket + set available=500
```

เปิด:
- Web: http://localhost:3000
- API OpenAPI: http://localhost:4000/openapi
- RedisInsight: http://localhost:8001

## API

Single-ticket demo — ทุก endpoint operate บน ticket เดียว (ticket id ซ่อนใน service)

| Method | Path | Body / Query | Description |
|---|---|---|---|
| POST | `/tickets/seed` | — | TRUNCATE + flush Redis + create ticket + set available |
| GET | `/tickets/available` | — | จำนวนที่เหลือใน Redis |
| GET | `/tickets/status` | `?userId` | `none` / `holding` (+ expiresAt) / `booked` |
| POST | `/tickets/booking` | `{ userId }` | hold seat 150s |
| POST | `/tickets/confirm` | `{ userId }` | promote hold → booked |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | web + api ใน watch mode (ต้องมี infra ขึ้นก่อน) |
| `pnpm build` | build ทุก workspace |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Prettier |
| `pnpm docker:up` | compose up ทุก service (db, redis, redisinsight, api, web) |
| `pnpm docker:down` | compose down |
| `pnpm docker:build` | rebuild docker images |
| `pnpm db:push` | push schema ไป Postgres |
| `pnpm db:studio` | เปิด Drizzle Studio |

## Load test

ใช้ [k6](https://k6.io) ยิงชน API โดยตรง (seed ให้เองใน `setup()`):

```bash
pnpm loadtest
# ปรับได้: PEAK_RPS=5000 MAX_VUS=10000 API_URL=http://localhost:4000 pnpm loadtest
```

Scenario ramp 0 → 2500 RPS ใน 3 วินาที, tag `hold` vs `confirm` แยก threshold กัน

> ⚠️ ถ้าเปิด `MOCK_PAYMENT_DELAY_MS > 0` threshold `confirm p95 < 500ms` จะไม่มีทางผ่านเพราะ sleep บังคับ — ตั้ง `MOCK_PAYMENT_DELAY_MS=0` ตอน loadtest

### Benchmark

**Environment**
- Hardware: Hardware: MacBook Pro 13" (2020), Intel Core i5 quad-core @ 2 GHz, 16 GB LPDDR4X
- Docker Desktop resources: 2 CPUs, 4 GB RAM, 1 GB swap
- API, Postgres, Redis ทั้งหมดรันใน docker container (compose network) — แชร์โควต้า 2 CPU / 4 GB นี้
- k6 รันจาก host ยิงเข้า `localhost:${APP_PORT}` ผ่าน port mapping → มี Docker Desktop VM + NAT overhead อยู่ในตัวเลข
- Scenario: `ramping-arrival-rate` 0 → 2500 RPS ใน 1s, hold 2s, ramp down 1s; peak 5000 VUs; random userId ทุก iteration

**Results**

วัด 2 เคสคู่กันเพื่อแยก system throughput ออกจาก UX latency:

| Metric | Target | Pure Redis path<br>(`MOCK_PAYMENT_DELAY_MS=0`) | With 2s mock payment<br>(`MOCK_PAYMENT_DELAY_MS=2000`) |
|---|---|---|---|
| Total requests | — | 7,932 | 6,897 |
| Sustained RPS | ≥ 250 | **1,967** | 1,708 |
| Hold p95 | < 500ms | **132ms** ✓ | 306ms ✓ |
| Confirm p95 | < 500ms | **285ms** ✓ | 2458ms _(dominated by sleep)_ |
| Checks passed | ≥ 98% | **100%** | 100% |
| Seats sold | 500 (no oversell) | 500 ✓ | 500 ✓ |

ตัวหนาคือตัวเลข "ระบบจริง" — confirm p95 285ms สะท้อน Redis atomic Lua path ล้วนๆ (SISMEMBER + EXISTS + SADD + DEL) บน 2 CPU / 4 GB container quota

**Notes**
- 8,001 requests > 500 seats → request ที่เหลือจะได้ `sold_out` / `already_holding` / `already_booked` เป็น expected error (checks ยังผ่าน 100% เพราะนับว่า "resolved" ถูกต้อง)
- ตัววัด "no oversell" = รัน `curl /tickets/available` หลัง test เสร็จ ต้อง = 0 และ `SCARD ticket:booked` = 500
- RPS ยังไม่ใช่ ceiling — 2500 RPS target ใน 1 วินาทีไม่พอให้ระบบ stress ถึง bottleneck ลอง `PEAK_RPS=10000 MAX_VUS=20000 pnpm loadtest` เพื่อหาเพดานจริง

## Adding shadcn components

รันจาก repo root target `apps/web` — ไฟล์จะลงที่ `packages/ui/src/components/`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import ใช้:
```tsx
import { Button } from "@workspace/ui/components/button"
```
