import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getNotificationsByUser, getUnreadCount } from "@/features/notifications/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const user = await getUserById(session.sub)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const member = await getWorkspaceMember(id, user.id)
    if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const [notifications, unreadCount] = await Promise.all([
      getNotificationsByUser(id, user.id),
      getUnreadCount(id, user.id),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("List notifications error:", error)
    return NextResponse.json({ error: "Failed to list notifications" }, { status: 500 })
  }
}
