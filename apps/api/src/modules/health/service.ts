import { sql } from "@workspace/db"
import { redis } from "@workspace/redis"

const TIMEOUT_MS = 500

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ])
}

async function checkDatabase(): Promise<"ok" | "down"> {
  try {
    await withTimeout(sql`select 1`, TIMEOUT_MS)
    return "ok"
  } catch {
    return "down"
  }
}

async function checkRedis(): Promise<"ok" | "down"> {
  try {
    await withTimeout(redis.ping(), TIMEOUT_MS)
    return "ok"
  } catch {
    return "down"
  }
}

export const healthService = {
  check: async () => {
    const [database, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ])
    return {
      message: "Service is healthy",
      timestamp: new Date().toISOString(),
      database,
      redis: redisStatus,
    }
  },
}
