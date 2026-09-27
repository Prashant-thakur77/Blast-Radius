import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { workspaces } from "./workspaces"
import { projects } from "./projects"
import { tasks } from "./tasks"
import { users } from "./users"

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("activity_task_idx").on(table.taskId),
    index("activity_project_created_idx").on(table.projectId, table.createdAt),
  ]
)

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityEvents.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [activityEvents.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [activityEvents.taskId],
    references: [tasks.id],
  }),
  actor: one(users, {
    fields: [activityEvents.actorUserId],
    references: [users.id],
  }),
}))

export type ActivityEvent = typeof activityEvents.$inferSelect
export type NewActivityEvent = typeof activityEvents.$inferInsert
