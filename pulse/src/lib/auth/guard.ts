import { redirect } from "next/navigation"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"

export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect("/sign-in")

  const user = await getUserById(session.sub)
  if (!user) redirect("/sign-in")

  return { id: user.id, username: user.username, displayName: user.displayName }
}
