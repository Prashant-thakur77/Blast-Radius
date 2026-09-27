"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "./theme-toggle"
import { RepoSwitcher } from "./repo-switcher"
import { apiFetch } from "@/lib/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Repo {
  id: string
  name: string
  remote_url: string | null
}

interface AppHeaderProps {
  repo?: Repo
  repos?: Repo[]
}

export function AppHeader({ repo, repos }: AppHeaderProps) {
  const [resetting, setResetting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [costInfo, setCostInfo] = useState<{ usd: number; tokens: number } | null>(null)

  useEffect(() => {
    if (!repo) return
    fetch(`/api/repos/${repo.id}/costs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((costs: { total_cost_usd: number; llm_input_tokens: number; llm_output_tokens: number; embedding_input_tokens: number }[]) => {
        let usd = 0
        let tokens = 0
        for (const c of costs) {
          usd += c.total_cost_usd ?? 0
          tokens += (c.llm_input_tokens ?? 0) + (c.llm_output_tokens ?? 0) + (c.embedding_input_tokens ?? 0)
        }
        setCostInfo({ usd, tokens })
      })
      .catch(() => {})
  }, [repo])

  const handleSync = async () => {
    if (!repo || syncing) return
    setSyncing(true)
    try {
      const res = await apiFetch(`/api/repos/${repo.id}/sync`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        if (data.snapshots_created > 0) {
          toast.success(`Synced ${data.snapshots_created} new commits`, {
            description: data.branches_synced.length > 0
              ? `Branches: ${data.branches_synced.join(", ")}`
              : "All branches up to date",
          })
          window.location.reload()
        } else {
          toast.info("Already up to date")
        }
      } else {
        toast.error("Sync failed")
      }
    } catch {
      toast.error("Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await apiFetch("/api/admin/reset", { method: "DELETE" })
      window.location.href = "/new"
    } catch {
      setResetting(false)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-11 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center z-50">
      <div className="w-11 flex items-center justify-center">
        <Link href="/">
          <Logo
            width={28}
            height={28}
            className="cursor-pointer w-[26px] h-[26px]"
          />
        </Link>
      </div>

      {repo && repos && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground/40 text-lg font-light select-none">/</span>
          <RepoSwitcher repo={repo} repos={repos} />
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3 pr-3">
        {costInfo && costInfo.usd > 0 && (
          <div className="flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground translate-y-px">
            <span>{(costInfo.tokens / 1000).toFixed(0)}k tokens</span>
            <span className="text-muted-foreground/30">|</span>
            <span>${costInfo.usd.toFixed(2)}</span>
          </div>
        )}
        {repo && (
          <Button
            variant="ghost"
            size="icon"
            disabled={syncing}
            onClick={handleSync}
            className="cursor-pointer h-7 w-7"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        )}
        <ThemeToggle />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={resetting}
              className="cursor-pointer h-7 w-7 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset everything?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the database, all repos, vectors, and generated data. You will need to re-add and re-ingest repositories.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={resetting}>
                {resetting ? "Resetting..." : "Reset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  )
}
