import { Elysia } from "elysia"

import { healthService } from "./service"

export const health = new Elysia({ prefix: "/health" }).get(
  "",
  () => healthService.check(),
  {
    tags: ["Health"],
  }
)
