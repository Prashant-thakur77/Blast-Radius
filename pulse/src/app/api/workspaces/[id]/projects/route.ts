import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { getProjectsByWorkspace, getProjectBySlug } from "@/features/projects/queries"
import { createProject } from "@/features/projects/mutations"
import { createProjectSchema } from "@/features/projects/schema"

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authorize(id)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const projects = await getProjectsByWorkspace(id)
    return NextResponse.json({ projects })
  } catch (error) {
    console.error("List projects error:", error)
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 })
  }
}

export async function POST(
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
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const { name, description, icon } = parsed.data
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const existing = await getProjectBySlug(id, slug)
    if (existing) {
      return NextResponse.json({ error: "A project with this name already exists" }, { status: 409 })
    }

    const projectId = await createProject(id, name.trim(), slug, description, icon, user.id)
    return NextResponse.json({
      project: { id: projectId, name: name.trim(), slug, description: description ?? null, icon, status: "planning" },
    })
  } catch (error) {
    console.error("Create project error:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
