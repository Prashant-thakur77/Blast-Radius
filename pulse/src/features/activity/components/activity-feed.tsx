import { ActivityItem } from "./activity-item"
import type { ActivityEventInfo } from "../types"

interface ActivityFeedProps {
  events: ActivityEventInfo[]
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/50">No activity yet</p>
    )
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </div>
  )
}
