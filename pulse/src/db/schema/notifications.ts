import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { workspaces } from "./workspaces"
import { projects } from "./projects"
import { tasks } from "./tasks"
import { users } from "./users"

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => users.id),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    payload: text("payload").notNull(),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("notifications_recipient_idx").on(table.recipientUserId, table.workspaceId, table.createdAt),
    index("notifications_unread_idx").on(table.recipientUserId, table.workspaceId, table.readAt),
  ]
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
    relationName: "notificationRecipient",
  }),
  actor: one(users, {
    fields: [notifications.actorUserId],
    references: [users.id],
    relationName: "notificationActor",
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id],
  }),
}))

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
