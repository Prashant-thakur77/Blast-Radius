import { notFound } from "next/navigation"
import { getSession } from "@/features/auth/session"
import { getWorkspaceBySlug, getWorkspaceMembers } from "@/features/workspace/queries"
import { getProjectBySlug } from "@/features/projects/queries"
import { getTasksByProject } from "@/features/tasks/queries"
import { ProjectDetailHeader } from "@/features/projects/components/project-detail-header"
import { TaskBoard } from "@/features/tasks/components/task-board"
import type { ProjectInfo } from "@/features/projects/types"
import type { TaskInfo } from "@/features/tasks/types"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; slug: string }>
}) {
  const { workspace: workspaceSlug, slug } = await params
  const session = await getSession()
  if (!session) notFound()

  const workspace = await getWorkspaceBySlug(workspaceSlug)
  if (!workspace) notFound()

  const project = await getProjectBySlug(workspace.id, slug)
  if (!project) notFound()

  const [rawTasks, members] = await Promise.all([
    getTasksByProject(project.id),
    getWorkspaceMembers(workspace.id),
  ])

  const projectInfo: ProjectInfo = {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status as ProjectInfo["status"],
    icon: project.icon as ProjectInfo["icon"],
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }

  const tasks: TaskInfo[] = rawTasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    workspaceId: t.workspaceId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeUserId: t.assigneeUserId,
    assigneeUsername: t.assigneeUsername,
    assigneeDisplayName: t.assigneeDisplayName,
    position: t.position,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }))

  return (
    <div className="px-4 py-4 md:px-[20px] md:py-[20px] lg:px-[20px]">
      <ProjectDetailHeader
        project={projectInfo}
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
      />

      <TaskBoard
        projectId={project.id}
        workspaceId={workspace.id}
        currentUserId={session.sub}
        initialTasks={tasks}
        members={members}
        readonly={project.status === "archived"}
      />
    </div>
  )
}
