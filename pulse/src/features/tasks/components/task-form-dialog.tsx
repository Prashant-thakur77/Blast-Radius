"use client"

import { useState } from "react"
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
import { TaskAssigneeSelect } from "./task-assignee-select"
import { taskPriorityConfig, taskPriorities } from "../task-priority"
import { taskStatusConfig, taskStatuses } from "../task-status"
import type { TaskInfo, TaskStatus, TaskPriority } from "../types"
import type { WorkspaceMemberInfo } from "@/features/workspace/types"

interface TaskFormDialogProps {
  projectId: string
  workspaceId: string
  members: WorkspaceMemberInfo[]
  task?: TaskInfo
  defaultStatus?: TaskStatus
  trigger: React.ReactNode
  onSaved?: (task: TaskInfo) => void
}

export function TaskFormDialog({
  projectId,
  workspaceId,
  members,
  task,
  defaultStatus = "todo",
  trigger,
  onSaved,
}: TaskFormDialogProps) {
  const isEdit = !!task

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium")
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus)
  const [assigneeUserId, setAssigneeUserId] = useState(task?.assigneeUserId ?? "__unassigned")
  const [saving, setSaving] = useState(false)

  const resolvedAssignee = assigneeUserId === "__unassigned" ? null : assigneeUserId

  const resetForm = () => {
    if (!isEdit) {
      setTitle("")
      setDescription("")
      setPriority("medium")
      setStatus(defaultStatus)
      setAssigneeUserId("__unassigned")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 1) return

    setSaving(true)
    try {
      const url = isEdit
        ? `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`
        : `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`

      const body = isEdit
        ? {
            title: title.trim(),
            description: description.trim(),
            priority,
            status,
            assigneeUserId: resolvedAssignee,
          }
        : {
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            status,
            assigneeUserId: resolvedAssignee || undefined,
          }

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `Failed to ${isEdit ? "update" : "create"} task`)
        setSaving(false)
        return
      }

      toast.success(isEdit ? "Task updated" : "Task created")
      setOpen(false)
      resetForm()
      onSaved?.(data.task)
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
          setTitle(task.title)
          setDescription(task.description ?? "")
          setPriority(task.priority)
          setStatus(task.status)
          setAssigneeUserId(task.assigneeUserId ?? "__unassigned")
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edit task details" : "Create a new task"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="h-8 text-sm"
              disabled={saving}
              onFocus={(e) => {
                const el = e.target
                requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="text-sm resize-none"
              rows={3}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as TaskStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {taskStatusConfig[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskPriorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {taskPriorityConfig[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <TaskAssigneeSelect
              members={members}
              value={assigneeUserId}
              onValueChange={setAssigneeUserId}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={saving || title.trim().length < 1}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : (
                isEdit ? "Save changes" : "Create task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
