import { requireAuth } from "@/lib/auth/guard"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()
  return <>{children}</>
}
