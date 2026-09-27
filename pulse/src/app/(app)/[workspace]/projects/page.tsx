import { notFound } from "next/navigation"
import { FolderKanban, Plus } from "lucide-react"
import { getWorkspaceBySlug } from "@/features/workspace/queries"
import { getProjectsByWorkspace } from "@/features/projects/queries"
import { getTaskCountsByProjects } from "@/features/tasks/queries"
import { Button } from "@/components/ui/button"
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog"
import { ProjectList } from "@/features/projects/components/project-list"
import type { ProjectInfo } from "@/features/projects/types"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const projects = await getProjectsByWorkspace(workspace.id)
  const taskCounts = await getTaskCountsByProjects(projects.map((p) => p.id))

  const projectInfos: ProjectInfo[] = projects.map((p) => ({
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    slug: p.slug,
    description: p.description,
    status: p.status as ProjectInfo["status"],
    icon: p.icon as ProjectInfo["icon"],
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))

  return (
    <div className="px-4 py-4 md:px-[20px] md:py-[20px] lg:px-[20px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
        <ProjectFormDialog
          workspaceId={workspace.id}
          workspaceSlug={slug}
          trigger={
            <Button size="sm" variant="outline" className="cursor-pointer">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New project
            </Button>
          }
        />
      </div>
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted/80 mb-5">
            <FolderKanban className="h-5 w-5 text-muted-foreground/70" />
          </div>
          <h3 className="text-sm font-medium">No projects yet</h3>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            Get started by creating your first project.
          </p>
          <div className="mt-6">
            <ProjectFormDialog
              workspaceId={workspace.id}
              workspaceSlug={slug}
              trigger={
                <Button size="sm" className="cursor-pointer">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New project
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <ProjectList
          projects={projectInfos}
          taskCounts={taskCounts}
          workspaceId={workspace.id}
          workspaceSlug={slug}
        />
      )}
    </div>
  )
}
