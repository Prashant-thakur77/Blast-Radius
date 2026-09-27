export interface CommentInfo {
  id: string
  taskId: string
  workspaceId: string
  authorUserId: string
  authorUsername: string
  authorDisplayName: string | null
  body: string
  createdAt: Date
  updatedAt: Date
}
