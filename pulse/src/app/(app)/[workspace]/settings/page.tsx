import { requireAuth } from "@/lib/auth/guard"
import { getWorkspaceBySlug, getWorkspaceMembers, getWorkspaceMember } from "@/features/workspace/queries"
import { WorkspaceGeneralSection } from "./workspace-general-section"
import { WorkspaceMembersSection } from "./workspace-members-section"
import { WorkspaceDangerSection } from "./workspace-danger-section"
import { notFound } from "next/navigation"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const user = await requireAuth()
  const { workspace: slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const members = await getWorkspaceMembers(workspace.id)
  const currentMember = await getWorkspaceMember(workspace.id, user.id)
  const isOwner = currentMember?.role === "owner"

  return (
    <div className="px-4 py-4 md:px-[20px] md:py-[20px] lg:px-[20px] max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight">Workspace Settings</h1>
      <div className="mt-5 space-y-8">
        <WorkspaceGeneralSection
          workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
          isOwner={isOwner}
        />
        <WorkspaceMembersSection
          workspaceId={workspace.id}
          members={members}
          currentUserId={user.id}
          isOwner={isOwner}
        />
        {isOwner && (
          <WorkspaceDangerSection
            workspace={{ id: workspace.id, name: workspace.name }}
          />
        )}
      </div>
    </div>
  )
}
