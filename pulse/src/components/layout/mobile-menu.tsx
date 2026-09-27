"use client"

import { useRouter, usePathname } from "next/navigation"
import { Moon, Sun, Search, UserRoundPen, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getNavItems } from "./nav-config"
import { useInbox } from "@/features/notifications/components/inbox-context"
import { useSearch } from "@/features/search/components/search-context"

interface MobileMenuProps {
  onClose: () => void
  workspaceSlug: string
}

export function MobileMenu({ onClose, workspaceSlug }: MobileMenuProps) {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const navItems = getNavItems(workspaceSlug)
  const { toggle: toggleInbox, unreadCount } = useInbox()
  const { setOpen: setSearchOpen } = useSearch()

  const toggleTheme = () => {
    const currentTheme = theme === "system" ? resolvedTheme : theme
    setTheme(currentTheme === "dark" ? "light" : "dark")
  }

  const handleNavigate = (path: string) => {
    onClose()
    router.push(path)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    onClose()
    router.push("/")
  }

  return (
    <div className="flex flex-col items-center py-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        if (item.isPanel) {
          return (
            <Button
              key={item.href}
              variant="ghost"
              size="icon"
              data-inbox-toggle
              onClick={() => {
                onClose()
                toggleInbox()
              }}
              className="cursor-pointer h-9 w-9 relative"
            >
              <Icon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 h-3.5 min-w-3.5 rounded-full bg-foreground/10 text-[10px] text-foreground/60 font-medium flex items-center justify-center px-1 tabular-nums">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          )
        }

        return (
          <Button
            key={item.href}
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate(item.href)}
            className={cn(
              "cursor-pointer h-9 w-9",
              isActive && "bg-brand/10 dark:bg-brand/20"
            )}
          >
            <Icon className="h-5 w-5" />
          </Button>
        )
      })}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          onClose()
          setSearchOpen(true)
        }}
        className="cursor-pointer h-9 w-9"
      >
        <Search className="h-5 w-5" />
      </Button>
      <Separator className="my-1 w-6" />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="cursor-pointer h-9 w-9"
      >
        {(theme === "system" ? resolvedTheme : theme) === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleNavigate(`/${workspaceSlug}/account`)}
        className="cursor-pointer h-9 w-9"
      >
        <UserRoundPen className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        className="cursor-pointer h-9 w-9"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  )
}
