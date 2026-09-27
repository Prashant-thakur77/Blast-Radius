import { redirect } from "next/navigation"
import { getSession } from "@/features/auth/session"
import { getDefaultWorkspace } from "@/features/workspace/queries"

export default async function RootPage() {
  const session = await getSession()
  if (!session) redirect("/landing")

  const workspace = await getDefaultWorkspace(session.sub)
  if (!workspace) redirect("/new-workspace")

  redirect(`/${workspace.slug}/dashboard`)
}
