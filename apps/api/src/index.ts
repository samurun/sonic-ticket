import { app } from "./app"
import { startHoldExpirySubscriber } from "./modules/tickets/expiry-subscriber"
import { startBookedSync } from "./modules/tickets/booked-sync"

startBookedSync()

const server = app.listen({
  port: Bun.env.APP_PORT || 3000,
  hostname: "0.0.0.0",
})

console.log(
  `🦊 Elysia is running at ${server.server?.hostname}:${server.server?.port}`
)

startHoldExpirySubscriber().catch((err) =>
  console.error("[expiry] failed to start:", err)
)
export type { App } from "./app"
