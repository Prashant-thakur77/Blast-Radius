"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getNavItems } from "./nav-config"
import { useInbox } from "@/features/notifications/components/inbox-context"

interface AppSidebarProps {
  workspaceSlug: string
}

export function AppSidebar({ workspaceSlug }: AppSidebarProps) {
  const pathname = usePathname()
  const navItems = getNavItems(workspaceSlug)
  const { toggle, isOpen, unreadCount } = useInbox()

  return (
    <TooltipProvider>
      <nav className="hidden md:flex fixed left-0 top-11 md:top-12 lg:top-[54px] bottom-0 w-10 md:w-10 lg:w-11 border-r bg-background flex-col items-center py-3 gap-3 z-40">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.isPanel
            ? isOpen
            : pathname === item.href || pathname.startsWith(`${item.href}/`)

          if (item.isPanel) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-inbox-toggle
                    onClick={toggle}
                    className={cn(
                      "cursor-pointer h-7 w-7 md:h-7 md:w-7 lg:h-7 lg:w-7 relative",
                      isActive && "bg-brand/10 hover:bg-brand/20 dark:bg-brand/20 dark:hover:bg-brand/30"
                    )}
                  >
                    <Icon className="h-4 w-4 md:h-4 md:w-4 lg:h-4 lg:w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 h-3.5 min-w-3.5 rounded-full bg-foreground/10 text-[10px] text-foreground/60 font-medium flex items-center justify-center px-1 tabular-nums">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "cursor-pointer h-7 w-7 md:h-7 md:w-7 lg:h-7 lg:w-7",
                      isActive && "bg-brand/10 hover:bg-brand/20 dark:bg-brand/20 dark:hover:bg-brand/30"
                    )}
                  >
                    <Icon className="h-4 w-4 md:h-4 md:w-4 lg:h-4 lg:w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}
