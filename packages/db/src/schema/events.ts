import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const eventStatus = pgEnum("event_status", [
  "draft",
  "on_sale",
  "sold_out",
  "closed",
])

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    venue: text("venue").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    saleStartsAt: timestamp("sale_starts_at", { withTimezone: true }).notNull(),
    saleEndsAt: timestamp("sale_ends_at", { withTimezone: true }).notNull(),
    status: eventStatus("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("events_status_sale_starts_idx").on(t.status, t.saleStartsAt)],
)

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
