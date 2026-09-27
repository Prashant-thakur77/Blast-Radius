"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type MobileView = "explorer" | "graph" | "chat"

interface MobileViewSelectorProps {
  view: MobileView
  onViewChange: (view: MobileView) => void
}

export function MobileViewSelector({ view, onViewChange }: MobileViewSelectorProps) {
  return (
    <div className="px-2 py-2 flex items-center justify-start border-b min-[1430px]:hidden">
      <div className="inline-flex items-center rounded-md border border-input">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange("explorer")}
          className={cn(
            "h-7 px-3 rounded-r-none border-r cursor-pointer",
            view === "explorer" && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span className="text-xs">Explorer</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange("graph")}
          className={cn(
            "h-7 px-3 rounded-none border-r cursor-pointer",
            view === "graph" && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span className="text-xs">Graph</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange("chat")}
          className={cn(
            "h-7 px-3 rounded-l-none cursor-pointer",
            view === "chat" && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span className="text-xs">Chat</span>
        </Button>
      </div>
    </div>
  )
}
