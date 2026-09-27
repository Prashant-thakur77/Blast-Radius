import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth/guard"
import { getWorkspaceBySlug } from "@/features/workspace/queries"
import { getProjectsByWorkspace } from "@/features/projects/queries"
import { getTaskCountsByProjects } from "@/features/tasks/queries"
import {
  getMyOpenTasks,
  getRecentWorkspaceActivity,
} from "@/features/dashboard/queries"
import { ProjectsOverview } from "@/features/dashboard/components/projects-overview"
import { MyTasksList } from "@/features/dashboard/components/my-tasks-list"
import { RecentActivityList } from "@/features/dashboard/components/recent-activity-list"
import type { ProjectInfo } from "@/features/projects/types"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const [user, workspace] = await Promise.all([
    requireAuth(),
    getWorkspaceBySlug(slug),
  ])
  if (!workspace) notFound()

  const [projects, myTasks, activity] = await Promise.all([
    getProjectsByWorkspace(workspace.id),
    getMyOpenTasks(workspace.id, user.id),
    getRecentWorkspaceActivity(workspace.id),
  ])

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
    <div className="px-4 py-4 md:px-[20px] md:py-[20px] lg:px-[20px] max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight mb-4">Dashboard</h1>

      <div className="space-y-8">
        <section>
          <SectionHeader title="My Tasks" count={myTasks.length} />
          <MyTasksList tasks={myTasks} workspaceSlug={slug} />
        </section>

        <section>
          <SectionHeader title="Projects" count={projects.length} />
          <ProjectsOverview projects={projectInfos} taskCounts={taskCounts} workspaceSlug={slug} />
        </section>

        <section>
          <SectionHeader title="Recent Activity" />
          <RecentActivityList events={activity} workspaceSlug={slug} />
        </section>
      </div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  )
}
