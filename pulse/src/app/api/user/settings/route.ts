import { NextResponse } from "next/server"
import { getSession } from "@/features/auth/session"
import { getUserById } from "@/features/auth/queries"
import { getUserSettings } from "@/features/settings/queries"
import { upsertNotificationPreferences } from "@/features/settings/mutations"
import { updateNotificationPreferencesSchema } from "@/features/settings/schema"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const user = await getUserById(session.sub)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const settings = await getUserSettings(user.id)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const user = await getUserById(session.sub)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateNotificationPreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    await upsertNotificationPreferences(user.id, parsed.data)
    const settings = await getUserSettings(user.id)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
