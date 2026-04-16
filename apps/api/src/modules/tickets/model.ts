import { t } from "elysia"

export const userIdBody = t.Object({
  userId: t.String({ format: "uuid" }),
})

export const userIdQuery = t.Object({
  userId: t.String({ format: "uuid" }),
})
