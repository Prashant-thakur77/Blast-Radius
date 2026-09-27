import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { clearSession } from "@/features/auth/session"

export async function POST() {
  await clearSession()
  return NextResponse.json({ success: true })
}

export async function GET() {
  await clearSession()
  redirect("/sign-in")
}
