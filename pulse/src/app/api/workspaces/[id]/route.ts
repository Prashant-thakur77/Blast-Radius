import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember, getWorkspaceBySlug } from "@/features/workspace/queries"
import { updateWorkspaceName, deleteWorkspace } from "@/features/workspace/mutations"
import { updateWorkspaceSchema } from "@/features/workspace/schema"

async function authorize(workspaceId: string) {
  const session = await getSession()
  if (!session) return null

  const user = await getUserById(session.sub)
  if (!user) return null

  const member = await getWorkspaceMember(workspaceId, user.id)
  if (!member || member.role !== "owner") return null

  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateWorkspaceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const { name } = parsed.data
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const existing = await getWorkspaceBySlug(slug)
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "A workspace with this name already exists" }, { status: 409 })
    }

    await updateWorkspaceName(id, name.trim(), slug)
    return NextResponse.json({ workspace: { id, name: name.trim(), slug } })
  } catch (error) {
    console.error("Update workspace error:", error)
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await deleteWorkspace(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete workspace error:", error)
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 })
  }
}
