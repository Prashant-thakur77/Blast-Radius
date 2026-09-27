import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { markAsRead } from "@/features/notifications/mutations"
import { db } from "@/db"
import { notifications } from "@/db/schema/notifications"
import { eq } from "drizzle-orm"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  try {
    const { id, notificationId } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const user = await getUserById(session.sub)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const member = await getWorkspaceMember(id, user.id)
    if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1)

    if (!notification || notification.recipientUserId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await markAsRead(notificationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark read error:", error)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
