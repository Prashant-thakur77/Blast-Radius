"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import type { UserSettingsInfo } from "@/features/settings/types"

interface NotificationsSectionProps {
  settings: UserSettingsInfo
}

const preferences = [
  {
    key: "notifyOnTaskAssigned" as const,
    label: "Task assignments",
    description: "Get notified when someone assigns a task to you",
  },
  {
    key: "notifyOnTaskComment" as const,
    label: "Comments",
    description: "Get notified when someone comments on your task",
  },
  {
    key: "notifyOnTaskStatusChange" as const,
    label: "Status changes",
    description: "Get notified when someone changes your task's status",
  },
]

export function NotificationsSection({ settings: initial }: NotificationsSectionProps) {
  const [settings, setSettings] = useState(initial)

  const handleToggle = async (key: keyof Omit<UserSettingsInfo, "userId">, value: boolean) => {
    const prev = settings[key]
    setSettings((s) => ({ ...s, [key]: value }))

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        setSettings((s) => ({ ...s, [key]: prev }))
        toast.error("Failed to update preference")
      }
    } catch {
      setSettings((s) => ({ ...s, [key]: prev }))
      toast.error("Network error")
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">Notifications</h2>
      <div className="mt-5 space-y-4">
        {preferences.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">{pref.label}</p>
              <p className="text-[11px] text-muted-foreground/70">{pref.description}</p>
            </div>
            <Switch
              checked={settings[pref.key]}
              onCheckedChange={(checked) => handleToggle(pref.key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
