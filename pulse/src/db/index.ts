import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as users from "./schema/users"
import * as workspaces from "./schema/workspaces"
import * as projects from "./schema/projects"
import * as tasks from "./schema/tasks"
import * as comments from "./schema/comments"
import * as activity from "./schema/activity"
import * as notifications from "./schema/notifications"
import * as userSettings from "./schema/user-settings"

const sqlite = new Database(process.env.PULSE_DB_PATH || "sqlite.db")
sqlite.pragma("journal_mode = WAL")

export const db = drizzle(sqlite, { schema: { ...users, ...workspaces, ...projects, ...tasks, ...comments, ...activity, ...notifications, ...userSettings } })
