import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  booked: integer("booked").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export type Ticket = typeof tickets.$inferSelect
export type NewTicket = typeof tickets.$inferInsert
