import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { removeWorkspaceMember } from "@/features/workspace/mutations"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await getUserById(session.sub)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const member = await getWorkspaceMember(id, currentUser.id)
    if (!member || member.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (member.id === memberId) {
      return NextResponse.json({ error: "Cannot remove the workspace owner" }, { status: 400 })
    }

    await removeWorkspaceMember(memberId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove member error:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
