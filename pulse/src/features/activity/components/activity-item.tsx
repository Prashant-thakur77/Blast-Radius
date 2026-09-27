import { Circle } from "lucide-react"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { formatActivityMessage } from "../formatters"
import type { ActivityEventInfo } from "../types"

interface ActivityItemProps {
  event: ActivityEventInfo
}

export function ActivityItem({ event }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <Circle className="h-2 w-2 mt-1.5 shrink-0 fill-current" />
      <p className="flex-1 leading-relaxed">
        <span className="font-medium text-foreground/80">{event.actorDisplayName || event.actorUsername}</span>{" "}
        {formatActivityMessage(event)}{" "}
        <span className="text-muted-foreground/60">
          {formatRelativeTime(new Date(event.createdAt))}
        </span>
      </p>
    </div>
  )
}
