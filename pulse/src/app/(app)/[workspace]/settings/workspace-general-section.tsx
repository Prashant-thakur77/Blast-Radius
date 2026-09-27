"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface WorkspaceGeneralSectionProps {
  workspace: { id: string; name: string; slug: string }
  isOwner: boolean
}

export function WorkspaceGeneralSection({ workspace, isOwner }: WorkspaceGeneralSectionProps) {
  const router = useRouter()
  const [name, setName] = useState(workspace.name)
  const [saving, setSaving] = useState(false)

  const nameChanged = name.trim() !== workspace.name && name.trim().length >= 2

  const handleRename = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to rename")
        setSaving(false)
        return
      }
      toast.success("Workspace renamed")
      router.push(`/${data.workspace.slug}/settings`)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">General</h2>
      <div className="mt-5 space-y-1.5">
        <p className="text-xs font-medium">Workspace name</p>
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner || saving}
            className="h-8 text-sm max-w-[240px]"
          />
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRename}
              disabled={!nameChanged || saving}
              className="shrink-0"
            >
              {saving ? "Renaming..." : "Rename"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
