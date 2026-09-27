import { ArrowDown, Minus, ArrowUp, type LucideIcon } from "lucide-react"
import type { TaskPriority } from "./types"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

export const taskPriorityConfig: Record<TaskPriority, { label: string; variant: BadgeVariant; icon: LucideIcon }> = {
  low: { label: "Low", variant: "secondary", icon: ArrowDown },
  medium: { label: "Medium", variant: "secondary", icon: Minus },
  high: { label: "High", variant: "secondary", icon: ArrowUp },
}

export const taskPriorities: TaskPriority[] = ["low", "medium", "high"]
