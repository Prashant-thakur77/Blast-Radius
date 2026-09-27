import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { createWorkspace } from "@/features/workspace/mutations"
import { getWorkspaceBySlug } from "@/features/workspace/queries"

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await getUserById(session.sub)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const { name } = await request.json()

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 })
    }

    const trimmed = name.trim()
    if (trimmed.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 })
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const existing = await getWorkspaceBySlug(slug)
    if (existing) {
      return NextResponse.json({ error: "A workspace with this name already exists" }, { status: 409 })
    }

    const workspace = await createWorkspace(trimmed, slug, session.sub)
    return NextResponse.json({ workspace })
  } catch (error) {
    console.error("Create workspace error:", error)
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 })
  }
}
