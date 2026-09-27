"use client"

import { useState, useEffect } from "react"
import { ActivityItem } from "./activity-item"
import type { ActivityEventInfo } from "../types"

interface RecentActivityProps {
  workspaceId: string
  projectId: string
}

export function RecentActivity({ workspaceId, projectId }: RecentActivityProps) {
  const [events, setEvents] = useState<ActivityEventInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/projects/${projectId}/activity`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId, projectId])

  if (loading) return null
  if (events.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {events.map((event) => (
          <ActivityItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
