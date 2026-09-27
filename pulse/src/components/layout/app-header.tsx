"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, Search } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { MobileMenu } from "./mobile-menu"
import { UserMenu } from "./user-menu"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { useSearch } from "@/features/search/components/search-context"

interface AppHeaderProps {
  user: { id: string; username: string; displayName?: string | null }
  workspace: { id: string; name: string; slug: string }
  workspaces: { id: string; name: string; slug: string }[]
}

export function AppHeader({ user, workspace, workspaces }: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { setOpen: setSearchOpen } = useSearch()

  return (
    <header className="fixed top-0 left-0 right-0 h-11 md:h-12 lg:h-[54px] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center z-50">
      <div className="w-11 md:w-10 lg:w-11 flex items-center justify-center">
        <Link href={`/${workspace.slug}/dashboard`}>
          <Logo
            width={28}
            height={28}
            className="cursor-pointer w-[18px] h-[18px] md:w-5 md:h-5 lg:w-[28px] lg:h-[28px]"
          />
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-muted-foreground/40 text-lg font-light select-none">/</span>
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
      </div>

      <div className="flex-1" />

      {/* Desktop: search + theme toggle + user menu */}
      <div className="hidden md:flex items-center gap-1.5 md:gap-2 pr-2 md:pr-3 lg:pr-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSearchOpen(true)}
          className="cursor-pointer flex items-center gap-2 text-xs h-7 px-2"
        >
          <Search className="h-3.5 w-3.5" />
          <kbd className="pointer-events-none text-[10px] font-medium text-muted-foreground/60 border rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </Button>
        <ThemeToggle />
        <UserMenu user={user} workspaceSlug={workspace.slug} />
      </div>

      {/* Mobile: hamburger menu */}
      <div className="md:hidden flex items-center justify-center w-11">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="cursor-pointer h-6 w-6"
        >
          {mobileMenuOpen ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Menu className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed top-11 left-0 right-0 bottom-0 bg-background/80 backdrop-blur-sm z-[60]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-11 right-0 w-11 bg-background border-l border-b rounded-bl-md shadow-lg z-[60] animate-in slide-in-from-top-2 duration-200">
            <MobileMenu onClose={() => setMobileMenuOpen(false)} workspaceSlug={workspace.slug} />
          </div>
        </>
      )}
    </header>
  )
}
