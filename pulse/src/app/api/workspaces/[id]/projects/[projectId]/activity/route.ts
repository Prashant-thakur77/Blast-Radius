import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getProjectById } from "@/features/projects/queries"
import { getRecentActivityByProject } from "@/features/activity/queries"
import { getActivityByTask } from "@/features/activity/queries"

async function authorize(workspaceId: string) {
  const session = await getSession()
  if (!session) return null

  const user = await getUserById(session.sub)
  if (!user) return null

  const member = await getWorkspaceMember(workspaceId, user.id)
  if (!member) return null

  return user
}

export async function GET(
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

    const url = new URL(request.url)
    const taskId = url.searchParams.get("taskId")

    if (taskId) {
      const events = await getActivityByTask(taskId)
      return NextResponse.json({ events })
    }

    const events = await getRecentActivityByProject(projectId)
    return NextResponse.json({ events })
  } catch (error) {
    console.error("List activity error:", error)
    return NextResponse.json({ error: "Failed to list activity" }, { status: 500 })
  }
}
