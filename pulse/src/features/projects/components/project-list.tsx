"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectFormDialog } from "./project-form-dialog"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { statusConfig } from "../project-status"
import { iconConfig } from "../project-icon"
import type { ProjectInfo, ProjectStatus, ProjectIcon } from "../types"

interface ProjectListProps {
  projects: ProjectInfo[]
  taskCounts: Record<string, { total: number; done: number }>
  workspaceId: string
  workspaceSlug: string
}

export function ProjectList({ projects, taskCounts, workspaceId, workspaceSlug }: ProjectListProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<ProjectInfo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleArchive = async (project: ProjectInfo) => {
    const newStatus = project.status === "archived" ? "active" : "archived"
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to update status")
        return
      }
      toast.success(newStatus === "archived" ? "Project archived" : "Project restored")
      router.refresh()
    } catch {
      toast.error("Network error")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects/${deleteTarget.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to delete project")
        return
      }
      toast.success("Project deleted")
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((project) => {
          const ic = iconConfig[project.icon ?? "folder-kanban"]
          const sc = statusConfig[project.status]
          const Icon = ic.icon
          const isArchived = project.status === "archived"
          const counts = taskCounts[project.id]
          const total = counts?.total ?? 0
          const done = counts?.done ?? 0

          return (
            <div
              key={project.id}
              className="group rounded-lg border p-3.5 transition-colors hover:border-foreground/20 cursor-pointer flex flex-col justify-between min-h-[88px]"
              onClick={() => router.push(`/${workspaceSlug}/projects/${project.slug}`)}
            >
              {/* Top row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{project.name}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums" suppressHydrationWarning>
                  {total > 0 && <>{done}/{total} &middot; </>}{formatRelativeTime(project.updatedAt)}
                </span>
              </div>

              {/* Description */}
              <div className="mt-1.5 min-h-[1lh] flex items-start gap-1">
                {project.description ? (
                  <>
                    <ProjectDescription text={project.description} />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground/30 leading-relaxed">No description</p>
                )}
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-2">
                <Badge variant="secondary">{sc.label}</Badge>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" className="h-6 w-6 cursor-pointer text-muted-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <ProjectFormDialog
                        workspaceId={workspaceId}
                        workspaceSlug={workspaceSlug}
                        project={project}
                        trigger={
                          <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem className="cursor-pointer" onSelect={() => handleArchive(project)}>
                        {isArchived ? (
                          <><ArchiveRestore className="h-3.5 w-3.5" /> Restore</>
                        ) : (
                          <><Archive className="h-3.5 w-3.5" /> Archive</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                        onSelect={() => setDeleteTarget(project)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProjectDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <p className={`text-xs text-muted-foreground leading-relaxed flex-1 ${expanded ? "" : "line-clamp-1"}`}>
        {text}
      </p>
      {text.length > 60 && (
        <button
          type="button"
          className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-foreground cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </>
  )
}

