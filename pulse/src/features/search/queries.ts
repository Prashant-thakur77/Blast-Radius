import { eq, and, like, or, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema/projects"
import { tasks } from "@/db/schema/tasks"
import type { SearchProjectResult, SearchTaskResult } from "./types"

export async function searchProjects(
  workspaceId: string,
  query: string,
  limit = 5
): Promise<SearchProjectResult[]> {
  const pattern = `%${query}%`
  return db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      status: projects.status,
      icon: projects.icon,
    })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        or(like(projects.name, pattern), like(projects.description, pattern))
      )
    )
    .orderBy(desc(projects.updatedAt))
    .limit(limit)
}

export async function searchTasks(
  workspaceId: string,
  query: string,
  limit = 5
): Promise<SearchTaskResult[]> {
  const pattern = `%${query}%`
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      projectSlug: projects.slug,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        or(like(tasks.title, pattern), like(tasks.description, pattern))
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)

  return rows as SearchTaskResult[]
}
