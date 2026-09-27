"use client"

import { type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface InlineTab {
  value: string
  label?: string
  icon?: ReactNode
}

interface InlineTabsProps {
  tabs: InlineTab[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function InlineTabs({ tabs, value, onChange, className }: InlineTabsProps) {
  return (
    <div className={cn("inline-flex items-center rounded-md border border-input", className)}>
      {tabs.map((tab, i) => (
        <Button
          key={tab.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(tab.value)}
          className={cn(
            "h-7 px-3 gap-1.5 cursor-pointer text-xs",
            i < tabs.length - 1 && "border-r",
            i === 0 && "rounded-r-none",
            i === tabs.length - 1 && "rounded-l-none",
            i > 0 && i < tabs.length - 1 && "rounded-none",
            value === tab.value && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {tab.icon}
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
