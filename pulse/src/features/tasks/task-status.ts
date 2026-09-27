import { Circle, CircleDot, CheckCircle2, type LucideIcon } from "lucide-react"
import type { TaskStatus } from "./types"

export const taskStatusConfig: Record<TaskStatus, { label: string; icon: LucideIcon }> = {
  todo: { label: "Todo", icon: Circle },
  in_progress: { label: "In Progress", icon: CircleDot },
  done: { label: "Done", icon: CheckCircle2 },
}

export const taskStatuses: TaskStatus[] = ["todo", "in_progress", "done"]
