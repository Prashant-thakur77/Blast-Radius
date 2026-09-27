"use client"

import { FolderTree, History } from "lucide-react"
import { cn } from "@/lib/utils"

export type ExplorerTab = "files" | "history"

const tabs = [
  { id: "files" as const, icon: FolderTree },
  { id: "history" as const, icon: History },
]

interface ExplorerHeaderProps {
  tab: ExplorerTab
  onTabChange: (tab: ExplorerTab) => void
}

export function ExplorerHeader({ tab, onTabChange }: ExplorerHeaderProps) {
  return (
    <div className="flex items-stretch text-xs border-b border-border h-[32px]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTabChange(t.id)}
          className={cn(
            "w-10 py-2 flex items-center justify-center border-r border-border transition-colors cursor-pointer",
            tab === t.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <t.icon className="size-3.5" />
        </button>
      ))}
      <div className="flex-1" />
    </div>
  )
}
