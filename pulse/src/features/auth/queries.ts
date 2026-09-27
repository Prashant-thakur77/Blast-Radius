import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema/users"

export async function getUserByUsername(username: string) {
  return db.query.users.findFirst({
    where: eq(users.username, username),
  })
}

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  })
}
