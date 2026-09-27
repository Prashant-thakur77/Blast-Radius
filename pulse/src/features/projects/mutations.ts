import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { projects } from "@/db/schema/projects"
import type { ProjectIcon } from "./types"

export async function createProject(
  workspaceId: string,
  name: string,
  slug: string,
  description: string | undefined,
  icon: ProjectIcon,
  createdBy: string
) {
  const now = new Date()
  const id = nanoid()
  await db.insert(projects).values({
    id,
    workspaceId,
    name,
    slug,
    description: description ?? null,
    icon,
    status: "planning",
    createdBy,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateProject(
  id: string,
  data: {
    name?: string
    slug?: string
    description?: string
    status?: string
    icon?: string
  }
) {
  await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
}

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id))
}
