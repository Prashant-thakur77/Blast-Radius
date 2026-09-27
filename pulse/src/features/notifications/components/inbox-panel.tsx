"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInbox } from "./inbox-context"
import { NotificationItem } from "./notification-item"
import type { NotificationInfo } from "../types"

interface InboxPanelProps {
  workspaceId: string
  workspaceSlug: string
}

export function InboxPanel({ workspaceId, workspaceSlug }: InboxPanelProps) {
  const { isOpen, close, refreshCount } = useInbox()
  const [notifications, setNotifications] = useState<NotificationInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/notifications`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (isOpen) fetchNotifications()
  }, [isOpen, fetchNotifications])

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    )
    try {
      await fetch(`/api/workspaces/${workspaceId}/notifications/${id}/read`, {
        method: "PATCH",
      })
      refreshCount()
    } catch {
      // silent
    }
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })))
    try {
      await fetch(`/api/workspaces/${workspaceId}/notifications/read-all`, {
        method: "POST",
      })
      refreshCount()
    } catch {
      // silent
    }
  }

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-inbox-toggle]")) return
      if (panelRef.current && !panelRef.current.contains(target)) {
        close()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen, close])

  if (!isOpen) return null

  const hasUnread = notifications.some((n) => !n.readAt)

  return (
      <div
        ref={panelRef}
        className="fixed z-[60] inset-0 md:inset-auto md:z-50 md:top-12 lg:top-[54px] md:bottom-0 md:left-10 lg:left-11 md:w-[350px] bg-background md:border-r flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Inbox</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={!hasUnread}
              className={`text-xs h-7 cursor-pointer ${hasUnread ? "" : "invisible"}`}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={close}
              className="h-6 w-6 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            null
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  workspaceSlug={workspaceSlug}
                  onRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
  )
}
