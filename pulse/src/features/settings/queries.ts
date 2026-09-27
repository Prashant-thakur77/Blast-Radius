import { eq } from "drizzle-orm"
import { db } from "@/db"
import { userSettings } from "@/db/schema/user-settings"
import type { UserSettingsInfo } from "./types"

const defaults: Omit<UserSettingsInfo, "userId"> = {
  notifyOnTaskAssigned: true,
  notifyOnTaskComment: true,
  notifyOnTaskStatusChange: true,
}

export async function getUserSettings(userId: string): Promise<UserSettingsInfo> {
  const row = await db
    .select({
      userId: userSettings.userId,
      notifyOnTaskAssigned: userSettings.notifyOnTaskAssigned,
      notifyOnTaskComment: userSettings.notifyOnTaskComment,
      notifyOnTaskStatusChange: userSettings.notifyOnTaskStatusChange,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  if (row.length === 0) {
    return { userId, ...defaults }
  }

  return row[0]
}
