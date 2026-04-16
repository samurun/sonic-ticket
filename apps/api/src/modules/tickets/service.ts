import { db, sql, tickets } from "@workspace/db"
import { redis } from "@workspace/redis"

const CAPACITY = 500
const HOLD_TTL_SECONDS = 150
const MOCK_PAYMENT_DELAY_MS = Number(process.env.MOCK_PAYMENT_DELAY_MS ?? 0)

const keys = {
  available: `ticket:available`,
  booked: `ticket:booked`,
  hold: (userId: string) => `ticket:hold:${userId}`,
}

redis.defineCommand("holdBooking", {
  numberOfKeys: 3,
  lua: `
    if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then
      return redis.error_reply('already_booked')
    end
    if not redis.call('SET', KEYS[2], '1', 'EX', ARGV[2], 'NX') then
      return redis.error_reply('already_holding')
    end
    local remaining = redis.call('DECR', KEYS[3])
    if remaining < 0 then
      redis.call('INCR', KEYS[3])
      redis.call('DEL', KEYS[2])
      return redis.error_reply('sold_out')
    end
    return remaining
  `,
})

redis.defineCommand("confirmBooked", {
  numberOfKeys: 2,
  lua: `
    if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then
      redis.call('DEL', KEYS[1])
      return 1
    end
    if redis.call('EXISTS', KEYS[1]) == 0 then
      return redis.error_reply('hold_expired_or_missing')
    end
    redis.call('SADD', KEYS[2], ARGV[1])
    redis.call('DEL', KEYS[1])
    return 1
  `,
})

const redisCmd = redis as typeof redis & {
  holdBooking(
    bookedKey: string,
    holdKey: string,
    availableKey: string,
    userId: string,
    ttlSeconds: number
  ): Promise<number>
  confirmBooked(
    holdKey: string,
    bookedKey: string,
    userId: string
  ): Promise<number>
}

function holdBooking(userId: string) {
  return redisCmd.holdBooking(
    keys.booked,
    keys.hold(userId),
    keys.available,
    userId,
    HOLD_TTL_SECONDS
  )
}

function confirmBooked(userId: string) {
  return redisCmd.confirmBooked(keys.hold(userId), keys.booked, userId)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function flushTicketKeys() {
  const stream = redis.scanStream({ match: "ticket:*", count: 200 })
  for await (const batch of stream as AsyncIterable<string[]>) {
    if (batch.length) await redis.del(...batch)
  }
}

export const ticketService = {
  async seed() {
    await sql`TRUNCATE tickets RESTART IDENTITY CASCADE`
    await flushTicketKeys()

    await db
      .insert(tickets)
      .values({ name: "Sonic Ticket", capacity: CAPACITY })

    await redis.set(keys.available, CAPACITY)

    return { capacity: CAPACITY }
  },

  async available() {
    const n = await redis.get(keys.available)
    return { available: Number(n) || 0 }
  },

  async status(userId: string) {
    const [isBooked, holdTtl] = await Promise.all([
      redis.sismember(keys.booked, userId),
      redis.ttl(keys.hold(userId)),
    ])

    if (isBooked) return { status: "booked" as const }
    if (holdTtl > 0) {
      return {
        status: "holding" as const,
        expiresAt: new Date(Date.now() + holdTtl * 1000),
      }
    }
    return { status: "none" as const }
  },

  async hold(userId: string) {
    const remaining = await holdBooking(userId)
    return {
      userId,
      expiresAt: new Date(Date.now() + HOLD_TTL_SECONDS * 1000),
      remaining,
    }
  },

  async confirm(userId: string) {
    // Fail-fast before the mock payment delay so an already-expired hold
    // doesn't block the caller for a second unnecessarily.
    if (!(await redis.exists(keys.hold(userId)))) {
      throw new Error("hold_expired_or_missing")
    }

    if (MOCK_PAYMENT_DELAY_MS > 0) await sleep(MOCK_PAYMENT_DELAY_MS)

    await confirmBooked(userId)
    return { ok: true }
  },
}
