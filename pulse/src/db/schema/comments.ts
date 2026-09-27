import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { tasks } from "./tasks"
import { workspaces } from "./workspaces"
import { users } from "./users"

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("comments_task_idx").on(table.taskId),
  ]
)

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  workspace: one(workspaces, {
    fields: [comments.workspaceId],
    references: [workspaces.id],
  }),
  author: one(users, {
    fields: [comments.authorUserId],
    references: [users.id],
  }),
}))

export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
