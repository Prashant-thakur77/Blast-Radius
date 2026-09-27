import { NextResponse } from "next/server"
import { getUserByUsername } from "@/features/auth/queries"
import { createUser } from "@/features/auth/mutations"

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

    const existing = await getUserByUsername(normalizedUsername)
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 })
    }

    const user = await createUser(normalizedUsername, password)
    return NextResponse.json({ user, created: true })
  } catch (error) {
    console.error("Sign up error:", error)
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 })
  }
}
