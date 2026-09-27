import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getProjectById, getProjectBySlug } from "@/features/projects/queries"
import { updateProject, deleteProject } from "@/features/projects/mutations"
import { updateProjectSchema } from "@/features/projects/schema"

async function authorize(workspaceId: string) {
  const session = await getSession()
  if (!session) return null

  const user = await getUserById(session.sub)
  if (!user) return null

  const member = await getWorkspaceMember(workspaceId, user.id)
  if (!member) return null

  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    const { id, projectId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const project = await getProjectById(projectId)
    if (!project || project.workspaceId !== id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const updates: Record<string, string> = {}
    if (parsed.data.name) {
      updates.name = parsed.data.name.trim()
      updates.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const existing = await getProjectBySlug(id, updates.slug)
      if (existing && existing.id !== projectId) {
        return NextResponse.json({ error: "A project with this name already exists" }, { status: 409 })
      }
    }
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.status) updates.status = parsed.data.status
    if (parsed.data.icon) updates.icon = parsed.data.icon

    await updateProject(projectId, updates)

    const updated = await getProjectById(projectId)
    return NextResponse.json({ project: updated })
  } catch (error) {
    console.error("Update project error:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    const { id, projectId } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const project = await getProjectById(projectId)
    if (!project || project.workspaceId !== id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    await deleteProject(projectId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete project error:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
