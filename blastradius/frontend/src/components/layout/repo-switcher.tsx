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

interface Repo {
  id: string
  name: string
  remote_url: string | null
}

interface RepoSwitcherProps {
  repo: Repo
  repos: Repo[]
}

function formatOrigin(url: string | null) {
  if (!url) return null
  return url.replace(/^https?:\/\//, "").replace(/\.git$/, "")
}

export function RepoSwitcher({ repo, repos }: RepoSwitcherProps) {
  const router = useRouter()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1.5 px-2 h-7 text-sm font-medium"
        >
          <span className="truncate max-w-[140px]">{repo.name}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Repositories
        </DropdownMenuLabel>
        {repos.map((r) => (
          <DropdownMenuItem
            key={r.id}
            className="cursor-pointer gap-2"
            onClick={() => {
              if (r.id !== repo.id) {
                router.push(`/${r.id}`)
                router.refresh()
              }
            }}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="truncate text-sm">{r.name}</span>
              {r.remote_url && (
                <span className="truncate text-[11px] text-muted-foreground/60">
                  {formatOrigin(r.remote_url)}
                </span>
              )}
            </div>
            {r.id === repo.id && (
              <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => router.push("/new")}
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Add repository</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
