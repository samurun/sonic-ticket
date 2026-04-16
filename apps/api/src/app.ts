import { openapi } from "@elysiajs/openapi"
import { Elysia } from "elysia"

import { health } from "./modules/health"
import cors from "@elysiajs/cors"
import { ticketRouter } from "./modules/tickets"

export const app = new Elysia()
  .use(cors())
  .use(openapi())
  .use(health)
  .use(ticketRouter)

export type App = typeof app
