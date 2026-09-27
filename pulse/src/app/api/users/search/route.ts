import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { searchUsersByUsername } from "@/features/workspace/queries"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || ""
    const workspaceId = searchParams.get("workspaceId") || ""

    if (!q || !workspaceId) {
      return NextResponse.json({ users: [] })
    }

    const users = await searchUsersByUsername(q, workspaceId)
    return NextResponse.json({ users })
  } catch (error) {
    console.error("User search error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
