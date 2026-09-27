import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { markAllAsRead } from "@/features/notifications/mutations"

export async function POST(
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

    await markAllAsRead(id, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark all read error:", error)
    return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 })
  }
}
