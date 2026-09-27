import Link from "next/link"
import { ListTodo } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { MyOpenTask } from "../types"

interface MyTasksListProps {
  tasks: MyOpenTask[]
  workspaceSlug: string
}

const priorityVariant: Record<string, "secondary" | "destructive" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
}

const statusLabel: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
}

export function MyTasksList({ tasks, workspaceSlug }: MyTasksListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
        <ListTodo className="h-5 w-5 mb-2 opacity-50" />
        No open tasks assigned to you
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/${workspaceSlug}/projects/${task.projectSlug}`}
          className="rounded-lg border p-3 transition-colors hover:border-foreground/20 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{task.title}</span>
            <Badge variant={priorityVariant[task.priority]} className="text-[10px] shrink-0">
              {task.priority}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">{task.projectName}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">{statusLabel[task.status] ?? task.status}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
