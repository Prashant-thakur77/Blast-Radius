"use client"

import { useRouter } from "next/navigation"
import { ChevronsUpDown, Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface WorkspaceSwitcherProps {
  workspace: { id: string; name: string; slug: string }
  workspaces: { id: string; name: string; slug: string }[]
}

export function WorkspaceSwitcher({ workspace, workspaces }: WorkspaceSwitcherProps) {
  const router = useRouter()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1.5 px-2 h-7 text-sm font-medium"
        >
          <span className="truncate max-w-[140px]">{workspace.name}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            className="cursor-pointer gap-2"
            onClick={() => {
              if (ws.id !== workspace.id) {
                router.push(`/${ws.slug}/dashboard`)
                router.refresh()
              }
            }}
          >
            <span className="truncate flex-1">{ws.name}</span>
            {ws.id === workspace.id && (
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => router.push("/new-workspace")}
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <span>New workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
