import { z } from "zod"

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .max(50)
    .trim()
    .transform((v) => v || null)
    .nullable(),
})

export const updateNotificationPreferencesSchema = z.object({
  notifyOnTaskAssigned: z.boolean().optional(),
  notifyOnTaskComment: z.boolean().optional(),
  notifyOnTaskStatusChange: z.boolean().optional(),
})
