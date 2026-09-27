"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface WorkspaceDangerSectionProps {
  workspace: { id: string; name: string }
}

export function WorkspaceDangerSection({ workspace }: WorkspaceDangerSectionProps) {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to delete")
        setDeleting(false)
        return
      }
      router.push("/new-workspace")
      router.refresh()
    } catch {
      toast.error("Network error")
      setDeleting(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight text-destructive">
        Danger Zone
      </h2>
      <div className="mt-5 rounded-lg border border-error-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-medium">Delete this workspace</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Once you delete a workspace, there is no going back.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="shrink-0 ml-4"
          >
            Delete this workspace
          </Button>
        </div>

        {showDeleteConfirm && (
          <div className="border-t border-error-border p-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-semibold text-foreground">{workspace.name}</span> to confirm
              </p>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={workspace.name}
                className="h-8"
                autoFocus
                disabled={deleting}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={confirmName !== workspace.name || deleting}
              >
                {deleting ? "Deleting..." : "I understand, delete this workspace"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowDeleteConfirm(false); setConfirmName("") }}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
