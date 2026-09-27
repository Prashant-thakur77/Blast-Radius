import { redirect } from "next/navigation"
import { getDefaultWorkspace } from "./queries"
import type { WorkspaceInfo } from "./types"

export async function resolveWorkspace(userId: string): Promise<WorkspaceInfo> {
  const workspace = await getDefaultWorkspace(userId)
  if (!workspace) redirect("/new-workspace")
  return { id: workspace.id, name: workspace.name, slug: workspace.slug }
}
