"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Plus, Loader2, Pencil, MessageSquareText } from "lucide-react"
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
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InlineTabs } from "@/components/ui/inline-tabs"
import { TaskColumn } from "./task-column"
import { TaskCard } from "./task-card"
import { TaskAssigneeSelect } from "./task-assignee-select"
import { taskStatuses, taskStatusConfig } from "../task-status"
import { taskPriorityConfig, taskPriorities } from "../task-priority"
import type { TaskInfo, TaskStatus, TaskPriority } from "../types"
import { CommentForm } from "@/features/comments/components/comment-form"
import { CommentItem } from "@/features/comments/components/comment-item"
import { ActivityItem } from "@/features/activity/components/activity-item"
import type { CommentInfo } from "@/features/comments/types"
import type { ActivityEventInfo } from "@/features/activity/types"
import type { WorkspaceMemberInfo } from "@/features/workspace/types"

interface TaskBoardProps {
  projectId: string
  workspaceId: string
  currentUserId: string
  initialTasks: TaskInfo[]
  members: WorkspaceMemberInfo[]
  readonly?: boolean
}

export function TaskBoard({
  projectId,
  workspaceId,
  currentUserId,
  initialTasks,
  members,
  readonly = false,
}: TaskBoardProps) {
  const [mounted, setMounted] = useState(false)
  const [tasks, setTasks] = useState<TaskInfo[]>(initialTasks)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState<TaskInfo | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addStatus, setAddStatus] = useState<TaskStatus>("todo")
  const [addOpen, setAddOpen] = useState(false)
  const prevTasksRef = useRef<TaskInfo[]>(initialTasks)

  useEffect(() => setMounted(true), [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const grouped = taskStatuses.reduce(
    (acc, s) => {
      acc[s] = tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position)
      return acc
    },
    {} as Record<TaskStatus, TaskInfo[]>
  )

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  const findColumn = useCallback(
    (id: string): TaskStatus | null => {
      if (taskStatuses.includes(id as TaskStatus)) return id as TaskStatus
      const task = tasks.find((t) => t.id === id)
      return task ? task.status : null
    },
    [tasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    prevTasksRef.current = [...tasks]
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeColumn = findColumn(active.id as string)
    const overColumn = findColumn(over.id as string)

    if (!activeColumn || !overColumn || activeColumn === overColumn) return

    setTasks((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, status: overColumn } : t))
    )
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      setTasks(prevTasksRef.current)
      return
    }

    const activeColumn = findColumn(active.id as string)
    if (!activeColumn) return

    const columnTasks = tasks
      .filter((t) => t.status === activeColumn)
      .sort((a, b) => a.position - b.position)

    const activeIdx = columnTasks.findIndex((t) => t.id === active.id)
    let overIdx = columnTasks.findIndex((t) => t.id === over.id)

    if (over.id === activeColumn) {
      overIdx = columnTasks.length - 1
    }

    let reordered = columnTasks
    if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
      reordered = arrayMove(columnTasks, activeIdx, overIdx)
    }

    const movedTask = reordered.find((t) => t.id === active.id)
    if (!movedTask) return

    const movedIdx = reordered.indexOf(movedTask)
    let newPosition: number

    if (reordered.length === 1) {
      newPosition = 1000
    } else if (movedIdx === 0) {
      newPosition = reordered[1].position - 1000
    } else if (movedIdx === reordered.length - 1) {
      newPosition = reordered[movedIdx - 1].position + 1000
    } else {
      newPosition = Math.floor(
        (reordered[movedIdx - 1].position + reordered[movedIdx + 1].position) / 2
      )
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === active.id ? { ...t, status: activeColumn, position: newPosition } : t
      )
    )

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${active.id}/move`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: activeColumn, position: newPosition }),
        }
      )
      if (!res.ok) {
        setTasks(prevTasksRef.current)
        toast.error("Failed to move task")
      }
    } catch {
      setTasks(prevTasksRef.current)
      toast.error("Network error")
    }
  }

  const handleTaskSaved = (saved: TaskInfo) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === saved.id)
      if (exists) {
        return prev.map((t) =>
          t.id === saved.id
            ? { ...saved, assigneeUsername: saved.assigneeUsername ?? exists.assigneeUsername }
            : t
        )
      }
      return [...prev, saved]
    })
  }

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  return (
    <div className="@container">
      {!readonly && (
        <div className="flex items-center mb-4">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              setAddStatus("todo")
              setAddOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New task
          </Button>
        </div>
      )}

      {mounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={readonly ? undefined : handleDragStart}
          onDragOver={readonly ? undefined : handleDragOver}
          onDragEnd={readonly ? undefined : handleDragEnd}
        >
          <div className="flex flex-col gap-6 @[768px]:flex-row @[768px]:gap-4">
            {taskStatuses.map((status) => (
              <TaskColumn
                key={status}
                status={status}
                tasks={grouped[status]}
                readonly={readonly}
                onAddTask={(s) => {
                  setAddStatus(s)
                  setAddOpen(true)
                }}
                onEditTask={(t) => {
                  if (readonly) return
                  setEditTask(t)
                  setEditOpen(true)
                }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-6 @[768px]:flex-row @[768px]:gap-4">
          {taskStatuses.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={grouped[status]}
              readonly={true}
              onAddTask={() => {}}
              onEditTask={() => {}}
            />
          ))}
        </div>
      )}

      <TaskDialogControlled
        key={`add-${addStatus}`}
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        members={members}
        defaultStatus={addStatus}
        onSaved={handleTaskSaved}
      />

      {editTask && (
        <TaskDialogControlled
          key={`edit-${editTask.id}`}
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o)
            if (!o) setEditTask(null)
          }}
          projectId={projectId}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          members={members}
          task={editTask}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  )
}

type FeedItem =
  | { kind: "comment"; data: CommentInfo }
  | { kind: "activity"; data: ActivityEventInfo }

function TaskDialogControlled({
  open,
  onOpenChange,
  projectId,
  workspaceId,
  currentUserId,
  members,
  task,
  defaultStatus = "todo",
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  workspaceId: string
  currentUserId: string
  members: WorkspaceMemberInfo[]
  task?: TaskInfo
  defaultStatus?: TaskStatus
  onSaved?: (task: TaskInfo) => void
  onDeleted?: (taskId: string) => void
}) {
  const isEdit = !!task
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium")
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus)
  const [assigneeUserId, setAssigneeUserId] = useState(task?.assigneeUserId ?? "__unassigned")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [comments, setComments] = useState<CommentInfo[]>([])
  const [activity, setActivity] = useState<ActivityEventInfo[]>([])
  const [mobileTab, setMobileTab] = useState<"details" | "comments">("details")
  const feedEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isEdit || !open || !task) return
    async function loadFeed() {
      try {
        const [commentsRes, activityRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${task!.id}/comments`),
          fetch(`/api/workspaces/${workspaceId}/projects/${projectId}/activity?taskId=${task!.id}`),
        ])
        if (commentsRes.ok) {
          const data = await commentsRes.json()
          setComments(data.comments)
        }
        if (activityRes.ok) {
          const data = await activityRes.json()
          setActivity(data.events)
        }
      } catch {
        // silent
      }
    }
    loadFeed()
  }, [isEdit, open, task, workspaceId, projectId])

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments.length, activity.length])

  const feedItems: FeedItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, data: c })),
    ...activity.map((a) => ({ kind: "activity" as const, data: a })),
  ].sort(
    (a, b) =>
      new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime()
  )

  const resolvedAssignee = assigneeUserId === "__unassigned" ? null : assigneeUserId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 1) return

    setSaving(true)
    try {
      const url = isEdit
        ? `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`
        : `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`

      const body = isEdit
        ? { title: title.trim(), description: description.trim(), priority, status, assigneeUserId: resolvedAssignee }
        : { title: title.trim(), description: description.trim() || undefined, priority, status, assigneeUserId: resolvedAssignee || undefined }

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
      onOpenChange(false)
      onSaved?.(data.task)
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to delete task")
        return
      }
      toast.success("Task deleted")
      onOpenChange(false)
      onDeleted?.(task.id)
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  const handleCommentAdded = (comment: CommentInfo) => {
    setComments((prev) => [...prev, comment])
  }

  const handleCommentUpdated = (updated: CommentInfo) => {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  const taskFormFields = (
    <div className="space-y-4">
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
    </div>
  )

  const taskForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {taskFormFields}
      <DialogFooter className={isEdit ? "flex justify-between sm:justify-between" : ""}>
        {isEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        )}
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
  )

  if (!isEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription className="sr-only">Create a new task</DialogDescription>
          </DialogHeader>
          {taskForm}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-0 max-w-none translate-x-0 translate-y-0 left-0 top-0 rounded-none border-0 flex flex-col p-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-3xl sm:max-h-[85vh] sm:rounded-xl sm:border sm:overflow-hidden">
        {/* Mobile tabs */}
        <div className="sm:hidden flex items-center justify-between p-4 pb-0">
          <DialogTitle className="sr-only">Edit task</DialogTitle>
          <InlineTabs
            tabs={[
              { value: "details", label: "Details", icon: <Pencil className="h-3 w-3" /> },
              { value: "comments", label: "Comments", icon: <MessageSquareText className="h-3 w-3" /> },
            ]}
            value={mobileTab}
            onChange={(v) => setMobileTab(v as "details" | "comments")}
          />
        </div>

        {/* Mobile: tabbed content */}
        <div className="flex-1 overflow-y-auto sm:hidden">
          {mobileTab === "details" ? (
            <div className="p-4">
              {taskForm}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {feedItems.length === 0 && (
                <p className="text-xs text-muted-foreground/50">No activity yet</p>
              )}
              {feedItems.map((item) =>
                item.kind === "comment" ? (
                  <CommentItem
                    key={`c-${item.data.id}`}
                    comment={item.data}
                    currentUserId={currentUserId}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    taskId={task.id}
                    onUpdated={handleCommentUpdated}
                    onDeleted={handleCommentDeleted}
                  />
                ) : (
                  <ActivityItem key={`a-${item.data.id}`} event={item.data} />
                )
              )}
              <div ref={feedEndRef} />
            </div>
          )}
        </div>

        {/* Mobile: pinned comment input (only on comments tab) */}
        {mobileTab === "comments" && (
          <div className="sm:hidden shrink-0 px-4 py-3 border-t bg-background">
            <CommentForm
              taskId={task.id}
              workspaceId={workspaceId}
              projectId={projectId}
              onCommentAdded={handleCommentAdded}
            />
          </div>
        )}

        {/* Desktop: side-by-side */}
        <div className="hidden sm:flex sm:flex-row sm:min-h-[400px] sm:max-h-[85vh]">
          {/* Left panel: task form */}
          <div className="w-1/2 p-4 overflow-y-auto">
            <DialogHeader className="mb-4">
              <DialogTitle>Edit task</DialogTitle>
              <DialogDescription className="sr-only">Edit task details</DialogDescription>
            </DialogHeader>
            {taskForm}
          </div>

          {/* Right panel: header + feed + input */}
          <div className="w-1/2 border-l flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-2 shrink-0">
              <DialogTitle>Comments and Activity</DialogTitle>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
              {feedItems.length === 0 && (
                <p className="text-xs text-muted-foreground/50">No activity yet</p>
              )}
              {feedItems.map((item) =>
                item.kind === "comment" ? (
                  <CommentItem
                    key={`c-${item.data.id}`}
                    comment={item.data}
                    currentUserId={currentUserId}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    taskId={task.id}
                    onUpdated={handleCommentUpdated}
                    onDeleted={handleCommentDeleted}
                  />
                ) : (
                  <ActivityItem key={`a-${item.data.id}`} event={item.data} />
                )
              )}
              <div ref={feedEndRef} />
            </div>

            <div className="px-4 py-3 border-t shrink-0">
              <CommentForm
                taskId={task.id}
                workspaceId={workspaceId}
                projectId={projectId}
                onCommentAdded={handleCommentAdded}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
