"use client"

import { useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { UserRound, UserRoundPen, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UserMenuProps {
  user: { id: string; username: string; displayName?: string | null }
  workspaceSlug: string
}

export function UserMenu({ user, workspaceSlug }: UserMenuProps) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/sign-in")
    router.refresh()
  }

  const label = user.displayName || user.username

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="cursor-pointer h-7 w-7">
        <UserRound className="h-5 w-5 lg:h-7 lg:w-7" />
      </Button>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="cursor-pointer h-7 w-7">
          <UserRound className="h-5 w-5 lg:h-7 lg:w-7" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">{label}</p>
          {user.displayName && (
            <p className="text-xs text-muted-foreground mt-0.5">{user.username}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(`/${workspaceSlug}/account`)}>
          <UserRoundPen className="h-4 w-4" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
