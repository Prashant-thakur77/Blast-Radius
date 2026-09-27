import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById, getUserByUsername } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { addWorkspaceMember } from "@/features/workspace/mutations"
import { addMemberSchema } from "@/features/workspace/schema"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const body = await request.json()
    const parsed = addMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const user = await getUserByUsername(parsed.data.username)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const existing = await getWorkspaceMember(id, user.id)
    if (existing) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 })
    }

    const memberId = await addWorkspaceMember(id, user.id, "member")
    return NextResponse.json({ member: { id: memberId, userId: user.id, username: user.username, displayName: user.displayName, role: "member" } })
  } catch (error) {
    console.error("Add member error:", error)
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
}
