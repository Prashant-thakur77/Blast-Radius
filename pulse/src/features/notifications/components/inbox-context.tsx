"use client"

import { createContext, useContext, useState, useCallback, useEffect } from "react"

interface InboxContextValue {
  isOpen: boolean
  toggle: () => void
  close: () => void
  unreadCount: number
  refreshCount: () => void
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error("useInbox must be used within InboxProvider")
  return ctx
}

export function InboxProvider({
  workspaceId,
  children,
}: {
  workspaceId: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/notifications`)
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount)
      }
    } catch {
      // silent
    }
  }, [workspaceId])

  useEffect(() => {
    refreshCount()
  }, [refreshCount])

  return (
    <InboxContext.Provider value={{ isOpen, toggle, close, unreadCount, refreshCount }}>
      {children}
    </InboxContext.Provider>
  )
}
