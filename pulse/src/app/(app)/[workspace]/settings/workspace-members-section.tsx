"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Trash2, Plus, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RoleBadge } from "@/components/shared/role-badge"
import type { WorkspaceMemberInfo } from "@/features/workspace/types"

interface WorkspaceMembersSectionProps {
  workspaceId: string
  members: WorkspaceMemberInfo[]
  currentUserId: string
  isOwner: boolean
}

export function WorkspaceMembersSection({
  workspaceId,
  members: initialMembers,
  currentUserId,
  isOwner,
}: WorkspaceMembersSectionProps) {
  const router = useRouter()
  const [memberList, setMemberList] = useState(initialMembers)
  const [showAddRow, setShowAddRow] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; displayName: string | null }[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}&workspaceId=${workspaceId}`
        )
        const data = await res.json()
        setSearchResults(data.users || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, workspaceId])

  const handleAdd = async (username: string) => {
    setAdding(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to add member")
        setAdding(false)
        return
      }
      toast.success(`Added ${username}`)
      setSearchQuery("")
      setSearchResults([])
      setShowAddRow(false)
      setMemberList((prev) => [
        ...prev,
        {
          id: data.member.id,
          userId: data.member.userId,
          username: data.member.username,
          displayName: data.member.displayName ?? null,
          role: "member",
          joinedAt: new Date(),
        },
      ])
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to remove member")
        setRemovingId(null)
        return
      }
      toast.success("Member removed")
      setMemberList((prev) => prev.filter((m) => m.id !== memberId))
      setConfirmRemoveId(null)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setRemovingId(null)
    }
  }

  const handleCancelAdd = () => {
    setShowAddRow(false)
    setSearchQuery("")
    setSearchResults([])
  }

  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">Manage access</h2>

      <div className="mt-5 rounded-lg border">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 text-xs text-muted-foreground font-medium border-b">
          <span>{memberList.length} member{memberList.length !== 1 ? "s" : ""}</span>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => showAddRow ? handleCancelAdd() : setShowAddRow(true)}
              className="cursor-pointer h-6 w-6 text-muted-foreground"
            >
              {showAddRow ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
        <div className="divide-y">
          {showAddRow && (
            <div className="px-4 py-3 bg-muted/30">
              <div className="relative">
                {adding ? (
                  <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Input
                  placeholder="Search username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                  autoFocus
                  disabled={adding}
                />
              </div>
              {searching && (
                <p className="text-xs text-muted-foreground mt-2">Searching...</p>
              )}
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-md border bg-background divide-y">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => !adding && handleAdd(user.username)}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm">{user.displayName || user.username}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && !searching && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">No users found</p>
              )}
            </div>
          )}
          {memberList.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.displayName || member.username}</p>
              </div>
              {removingId === member.id ? (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
              ) : (
                <>
                  <RoleBadge role={member.role} />
                  {isOwner && member.role !== "owner" && (
                    confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleRemove(member.id)}
                        >
                          Remove
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
