"use client"

import { Sparkle, Waypoints } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Flow } from "@/lib/parse-flow-blocks"

interface FlowCardProps {
  flow: Flow
  isActive: boolean
  onClick: () => void
}

export function FlowCard({ flow, isActive, onClick }: FlowCardProps) {
  const edgeCount = flow.edge_keys?.length ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer my-1.5 animate-fade-in",
        isActive
          ? "border-primary/50 ring-1 ring-primary/20"
          : "border-border hover:bg-muted",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-medium truncate",
          isActive ? "text-foreground" : "text-foreground/80",
        )}>
          {flow.label}
        </p>
        {flow.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{flow.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Sparkle className="size-2.5" />
            {flow.node_ids.length}
          </span>
          {edgeCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Waypoints className="size-2.5" />
              {edgeCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
