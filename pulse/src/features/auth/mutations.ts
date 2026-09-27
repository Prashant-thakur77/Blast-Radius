import { nanoid } from "nanoid"
import { db } from "@/db"
import { users } from "@/db/schema/users"
import { hashPassword, verifyPassword } from "./hash"
import { createSession } from "./session"
import { getUserByUsername } from "./queries"

export async function createUser(username: string, password: string) {
  const passwordHash = await hashPassword(password)
  const now = new Date()
  const newUser = {
    id: nanoid(),
    username,
    passwordHash,
    createdAt: now,
  }

  await db.insert(users).values(newUser)

  await createSession({ id: newUser.id, username: newUser.username })

  return { id: newUser.id, username: newUser.username }
}

export async function signInUser(username: string, password: string) {
  const user = await getUserByUsername(username)

  if (!user) return null

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null

  await createSession({ id: user.id, username: user.username })

  return { id: user.id, username: user.username }
}
