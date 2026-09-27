import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/guard"
import { getWorkspaceBySlug, getUserWorkspaces, getWorkspaceMember } from "@/features/workspace/queries"
import { AppShell } from "@/components/layout/app-shell"

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspace: string }>
}) {
  const user = await requireAuth()
  const { workspace: slug } = await params

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) {
    const workspaces = await getUserWorkspaces(user.id)
    if (workspaces.length > 0) redirect(`/${workspaces[0].slug}/dashboard`)
    redirect("/new-workspace")
  }

  const member = await getWorkspaceMember(workspace.id, user.id)
  if (!member) {
    const workspaces = await getUserWorkspaces(user.id)
    if (workspaces.length > 0) redirect(`/${workspaces[0].slug}/dashboard`)
    redirect("/new-workspace")
  }

  const workspaces = await getUserWorkspaces(user.id)

  return (
    <AppShell
      user={user}
      workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
      workspaces={workspaces}
    >
      {children}
    </AppShell>
  )
}
