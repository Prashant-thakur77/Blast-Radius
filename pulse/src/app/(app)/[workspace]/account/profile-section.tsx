"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ProfileSectionProps {
  user: { id: string; username: string; displayName?: string | null }
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(user.displayName ?? "")
  const [saving, setSaving] = useState(false)

  const currentValue = user.displayName ?? ""
  const hasChanged = displayName.trim() !== currentValue

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to update profile")
        setSaving(false)
        return
      }
      toast.success("Profile updated")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Username</p>
          <Input value={user.username} disabled className="h-8 text-sm max-w-[240px]" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Display name</p>
          <div className="flex items-center gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter a display name"
              disabled={saving}
              maxLength={50}
              className="h-8 text-sm max-w-[240px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanged || saving}
              className="shrink-0"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
