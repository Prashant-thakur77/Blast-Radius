"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { iconConfig, projectIcons } from "../project-icon"
import { statusConfig } from "../project-status"
import type { ProjectInfo, ProjectStatus, ProjectIcon } from "../types"

interface ProjectFormDialogProps {
  workspaceId: string
  workspaceSlug: string
  project?: ProjectInfo
  trigger: React.ReactNode
}

export function ProjectFormDialog({
  workspaceId,
  workspaceSlug,
  project,
  trigger,
}: ProjectFormDialogProps) {
  const router = useRouter()
  const isEdit = !!project

  const [open, setOpen] = useState(false)
  const [name, setName] = useState(project?.name ?? "")
  const [description, setDescription] = useState(project?.description ?? "")
  const [icon, setIcon] = useState<ProjectIcon>(project?.icon ?? "folder-kanban")
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning")
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    if (!isEdit) {
      setName("")
      setDescription("")
      setIcon("folder-kanban")
      setStatus("planning")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return

    setSaving(true)
    try {
      const url = isEdit
        ? `/api/workspaces/${workspaceId}/projects/${project.id}`
        : `/api/workspaces/${workspaceId}/projects`

      const body = isEdit
        ? { name: name.trim(), description: description.trim() || undefined, status, icon }
        : { name: name.trim(), description: description.trim() || undefined, icon }

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `Failed to ${isEdit ? "update" : "create"} project`)
        setSaving(false)
        return
      }

      toast.success(isEdit ? "Project updated" : "Project created")
      setOpen(false)
      resetForm()

      if (isEdit && data.project?.slug !== project.slug) {
        router.push(`/${workspaceSlug}/projects/${data.project.slug}`)
      }
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
        if (nextOpen && isEdit) {
          setName(project.name)
          setDescription(project.description ?? "")
          setIcon(project.icon)
          setStatus(project.status)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edit project details" : "Create a new project"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="h-8 text-sm"
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="text-sm resize-none"
              rows={3}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {projectIcons.map((i) => {
                const ic = iconConfig[i]
                const Icon = ic.icon
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={`flex items-center justify-center h-8 w-full rounded-md cursor-pointer transition-colors ${
                      icon === i
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                    title={ic.label}
                    disabled={saving}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusConfig) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusConfig[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" size="sm" disabled={saving || name.trim().length < 2}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : (
                isEdit ? "Save changes" : "Create project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
