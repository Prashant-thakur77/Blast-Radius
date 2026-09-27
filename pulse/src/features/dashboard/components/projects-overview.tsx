import Link from "next/link"
import { iconConfig } from "@/features/projects/project-icon"
import type { ProjectInfo, ProjectIcon } from "@/features/projects/types"

interface ProjectsOverviewProps {
  projects: ProjectInfo[]
  taskCounts: Record<string, { total: number; done: number }>
  workspaceSlug: string
}

export function ProjectsOverview({ projects, taskCounts, workspaceSlug }: ProjectsOverviewProps) {
  if (projects.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {projects.map((project) => {
        const ic = iconConfig[project.icon as ProjectIcon ?? "folder-kanban"]
        const Icon = ic.icon
        const counts = taskCounts[project.id]
        const total = counts?.total ?? 0
        const done = counts?.done ?? 0
        const pct = total > 0 ? Math.round((done / total) * 100) : 0

        return (
          <Link
            key={project.id}
            href={`/${workspaceSlug}/projects/${project.slug}`}
            className="rounded-lg border p-3 transition-colors hover:border-foreground/20 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{project.name}</span>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/20"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {done}/{total}
                </span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
