import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getWorkspaceMember } from "@/features/workspace/queries"
import { searchProjects, searchTasks } from "@/features/search/queries"

export async function GET(
  request: Request,
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

    const url = new URL(request.url)
    const q = url.searchParams.get("q")?.trim()

    if (!q) {
      return NextResponse.json({ projects: [], tasks: [] })
    }

    const [projects, tasks] = await Promise.all([
      searchProjects(id, q),
      searchTasks(id, q),
    ])

    return NextResponse.json({ projects, tasks })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
