import Elysia from "elysia"
import { ticketService } from "./service"
import { userIdBody, userIdQuery } from "./model"

export const ticketRouter = new Elysia({ prefix: "/tickets" })
  .post("/seed", ticketService.seed, { tags: ["Tickets"] })
  .get("/available", () => ticketService.available(), { tags: ["Tickets"] })
  .get("/status", ({ query }) => ticketService.status(query.userId), {
    tags: ["Tickets"],
    query: userIdQuery,
  })
  .post("/booking", ({ body }) => ticketService.hold(body.userId), {
    tags: ["Tickets"],
    body: userIdBody,
  })
  .post("/confirm", ({ body }) => ticketService.confirm(body.userId), {
    tags: ["Tickets"],
    body: userIdBody,
  })
