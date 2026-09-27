import { z } from "zod"

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50),
})

export const addMemberSchema = z.object({
  username: z.string().min(1),
})
