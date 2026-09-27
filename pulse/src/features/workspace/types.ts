export type WorkspaceRole = "owner" | "member"

export interface WorkspaceInfo {
  id: string
  name: string
  slug: string
}

export interface WorkspaceMemberInfo {
  id: string
  userId: string
  username: string
  displayName: string | null
  role: WorkspaceRole
  joinedAt: Date
}
