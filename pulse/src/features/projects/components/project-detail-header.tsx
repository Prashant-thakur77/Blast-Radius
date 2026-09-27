"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import type { ProjectInfo } from "../types"

interface ProjectDetailHeaderProps {
  project: ProjectInfo
  workspaceId: string
  workspaceSlug: string
}

export function ProjectDetailHeader({ project, workspaceId, workspaceSlug }: ProjectDetailHeaderProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const isArchived = project.status === "archived"

  const handleArchive = async () => {
    const newStatus = isArchived ? "active" : "archived"
    setArchiving(true)
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
      toast.success(isArchived ? "Project restored" : "Project archived")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects/${project.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to delete project")
        return
      }
      toast.success("Project deleted")
      router.push(`/${workspaceSlug}/projects`)
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm mb-4">
        <Link
          href={`/${workspaceSlug}/projects`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium">{project.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="h-6 w-6 cursor-pointer text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
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
            <DropdownMenuItem className="cursor-pointer" onSelect={handleArchive}>
              {isArchived ? (
                <><ArchiveRestore className="h-3.5 w-3.5" /> Restore</>
              ) : (
                <><Archive className="h-3.5 w-3.5" /> Archive</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {project.description && (
        <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
      )}

      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 mb-4">
          <span className="text-sm text-muted-foreground">This project is archived.</span>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={handleArchive}
            disabled={archiving}
          >
            {archiving ? "Restoring..." : "Restore"}
          </Button>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) setDeleteOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{project.name}</span>? This will also delete all tasks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>
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
