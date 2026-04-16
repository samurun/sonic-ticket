import { app } from "./app"

const server = app.listen({
  port: Bun.env.APP_PORT || 3000,
  hostname: "0.0.0.0",
})

console.log(
  `🦊 Elysia is running at ${server.server?.hostname}:${server.server?.port}`,
)

export type { App } from "./app"
