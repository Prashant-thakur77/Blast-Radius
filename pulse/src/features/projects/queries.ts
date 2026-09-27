import { eq, and, desc } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema/projects"

export async function getProjectsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.createdAt))
}

export async function getProjectBySlug(workspaceId: string, slug: string) {
  return db.query.projects.findFirst({
    where: and(
      eq(projects.workspaceId, workspaceId),
      eq(projects.slug, slug)
    ),
  })
}

export async function getProjectById(id: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, id),
  })
}
