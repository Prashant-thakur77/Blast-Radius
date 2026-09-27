import { z } from "zod/v4"

export const signInSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type SignInInput = z.infer<typeof signInSchema>
