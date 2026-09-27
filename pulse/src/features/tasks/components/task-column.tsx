"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { taskStatusConfig } from "../task-status"
import { TaskCard } from "./task-card"
import type { TaskInfo, TaskStatus } from "../types"

interface TaskColumnProps {
  status: TaskStatus
  tasks: TaskInfo[]
  readonly?: boolean
  onAddTask: (status: TaskStatus) => void
  onEditTask: (task: TaskInfo) => void
}

export function TaskColumn({ status, tasks, readonly, onAddTask, onEditTask }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = taskStatusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="flex flex-col flex-1 @[768px]:min-w-[220px]">
      <div className="flex items-center gap-2 px-1 mb-3">
        <StatusIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{config.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        <div className="flex-1" />
        {!readonly && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => onAddTask(status)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 rounded-lg p-1.5 min-h-[120px] transition-colors ${
          isOver ? "bg-muted/50" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} readonly={readonly} onClick={() => onEditTask(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
