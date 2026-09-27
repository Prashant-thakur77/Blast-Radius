"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { useSearch } from "./search-context"
import { getNavItems } from "@/components/layout/nav-config"
import { iconConfig } from "@/features/projects/project-icon"
import type { SearchResponse } from "../types"
import type { ProjectIcon } from "@/features/projects/types"

interface CommandSearchProps {
  workspaceId: string
  workspaceSlug: string
}

export function CommandSearch({ workspaceId, workspaceSlug }: CommandSearchProps) {
  const { open, setOpen } = useSearch()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const navItems = getNavItems(workspaceSlug)

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, setOpen])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults(null)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(query.trim())}`
        )
        if (res.ok) {
          const data = await res.json()
          setResults(data)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query, workspaceId])

  const handleSelect = useCallback(
    (url: string) => {
      setOpen(false)
      router.push(url)
    },
    [setOpen, router]
  )

  const hasQuery = query.trim().length > 0
  const hasResults =
    results && (results.projects.length > 0 || results.tasks.length > 0)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search projects and tasks"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search projects and tasks..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="min-h-[168px]">
        {hasQuery && !loading && !hasResults && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}

        {/* Zero-query: navigation actions */}
        {!hasQuery && (
          <CommandGroup heading="Navigation">
            {navItems
              .filter((item) => !item.isPanel)
              .map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </CommandItem>
                )
              })}
          </CommandGroup>
        )}

        {/* Project results */}
        {hasQuery && results && results.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {results.projects.map((project) => {
              const config = iconConfig[project.icon as ProjectIcon]
              const Icon = config?.icon
              return (
                <CommandItem
                  key={project.id}
                  onSelect={() =>
                    handleSelect(`/${workspaceSlug}/projects/${project.slug}`)
                  }
                >
                  {Icon && (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{project.name}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Task results */}
        {hasQuery && results && results.tasks.length > 0 && (
          <>
            {results.projects.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Tasks">
              {results.tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  onSelect={() =>
                    handleSelect(
                      `/${workspaceSlug}/projects/${task.projectSlug}`
                    )
                  }
                >
                  <span className="truncate">{task.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate">
                    {task.projectName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
