import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { users } from "./users"

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyOnTaskAssigned: integer("notify_on_task_assigned", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyOnTaskComment: integer("notify_on_task_comment", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyOnTaskStatusChange: integer("notify_on_task_status_change", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export type UserSettings = typeof userSettings.$inferSelect
export type NewUserSettings = typeof userSettings.$inferInsert
