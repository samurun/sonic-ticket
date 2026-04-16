import { redis } from "@workspace/redis"

const DB = Number(process.env.REDIS_DB ?? 0)
const HOLD_KEY_REGEX = /^ticket:([^:]+):hold:([^:]+)$/

export async function startHoldExpirySubscriber() {
  await redis.config("SET", "notify-keyspace-events", "Ex")

  const sub = redis.duplicate()
  await sub.subscribe(`__keyevent@${DB}__:expired`)

  sub.on("message", async (_channel, key) => {
    const match = HOLD_KEY_REGEX.exec(key)
    if (!match) return

    const [, ticketId, userId] = match
    const inBooked = await redis.sismember(
      `ticket:${ticketId}:booked`,
      userId,
    )
    if (inBooked) return

    await redis.incr(`ticket:${ticketId}:available`)
    console.log(`[expiry] released seat for ticket=${ticketId} user=${userId}`)
  })

  console.log("[expiry] hold-expiry subscriber ready")
}
