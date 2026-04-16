import { openapi } from "@elysiajs/openapi"
import { Elysia } from "elysia"

import { health } from "./modules/health"
import cors from "@elysiajs/cors"

export const app = new Elysia().use(cors()).use(openapi()).use(health)

export type App = typeof app
