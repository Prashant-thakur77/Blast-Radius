// Test setup for BlastRadius regression tests.
// Every test file gets a fresh in-memory SQLite database with the real
// drizzle migrations, and a mocked session so route handlers can be called
// directly with a signed-in user.
import { vi } from "vitest"

process.env.PULSE_DB_PATH = ":memory:"

vi.mock("@/features/auth/session", () => ({
  getSession: vi.fn(async () => null),
  createSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
}))

const { migrate } = await import("drizzle-orm/better-sqlite3/migrator")
const { db } = await import("@/db")
migrate(db, { migrationsFolder: "./drizzle" })
