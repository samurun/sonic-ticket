import { db, tickets } from "@workspace/db"
import { redis } from "@workspace/redis"
import { eq } from "drizzle-orm"

const SYNC_INTERVAL_MS = Number(process.env.BOOKED_SYNC_INTERVAL_MS ?? 10_000)

async function syncOnce() {
  const rows = await db.select({ id: tickets.id }).from(tickets)
  if (rows.length === 0) return

  await Promise.all(
    rows.map(async ({ id }) => {
      const count = await redis.scard(`ticket:${id}:booked`)
      await db.update(tickets).set({ booked: count }).where(eq(tickets.id, id))
    }),
  )
}

export function startBookedSync() {
  const timer = setInterval(() => {
    syncOnce().catch((err) => console.error("[booked-sync] failed:", err))
  }, SYNC_INTERVAL_MS)
  timer.unref?.()
  console.log(`[booked-sync] ready (every ${SYNC_INTERVAL_MS}ms)`)
}
