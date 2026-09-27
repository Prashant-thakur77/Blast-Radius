import { NextResponse } from "next/server"
import { signInUser } from "@/features/auth/mutations"
import { getDefaultWorkspace } from "@/features/workspace/queries"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 })
    }

    const normalizedUsername = username.trim().toLowerCase()

    if (normalizedUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const user = await signInUser(normalizedUsername, password)

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    const workspace = await getDefaultWorkspace(user.id)
    return NextResponse.json({
      user,
      hasWorkspace: !!workspace,
      workspaceSlug: workspace?.slug ?? null,
    })
  } catch (error) {
    console.error("Sign in error:", error)
    return NextResponse.json({ error: "Sign in failed" }, { status: 500 })
  }
}
