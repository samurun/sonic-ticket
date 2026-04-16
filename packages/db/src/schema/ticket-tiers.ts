import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { events } from "./events"

export const ticketTiers = pgTable(
  "ticket_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    capacity: integer("capacity").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("ticket_tiers_event_idx").on(t.eventId)],
)

export type TicketTier = typeof ticketTiers.$inferSelect
export type NewTicketTier = typeof ticketTiers.$inferInsert
