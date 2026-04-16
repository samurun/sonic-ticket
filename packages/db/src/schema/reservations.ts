import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { ticketTiers } from "./ticket-tiers"
import { users } from "./users"

export const reservationStatus = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
])

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tierId: uuid("tier_id")
      .references(() => ticketTiers.id, { onDelete: "cascade" })
      .notNull(),
    quantity: integer("quantity").notNull(),
    status: reservationStatus("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("reservations_status_expires_idx").on(t.status, t.expiresAt),
    index("reservations_user_status_idx").on(t.userId, t.status),
  ],
)

export type Reservation = typeof reservations.$inferSelect
export type NewReservation = typeof reservations.$inferInsert
