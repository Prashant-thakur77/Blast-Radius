import { requireAuth } from "@/lib/auth/guard"
import { getUserSettings } from "@/features/settings/queries"
import { ProfileSection } from "./profile-section"
import { NotificationsSection } from "./notifications-section"
import { AccountDangerSection } from "./account-danger-section"

export default async function AccountPage() {
  const user = await requireAuth()
  const settings = await getUserSettings(user.id)

  return (
    <div className="px-4 py-4 md:px-[20px] md:py-[20px] lg:px-[20px] max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight">Account Settings</h1>
      <div className="mt-5 space-y-8">
        <ProfileSection user={user} />
        <NotificationsSection settings={settings} />
        <AccountDangerSection username={user.username} />
      </div>
    </div>
  )
}
