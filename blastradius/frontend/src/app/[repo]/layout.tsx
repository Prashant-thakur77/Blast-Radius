import { redirect } from "next/navigation"
import { AppHeader } from "@/components/layout/app-header"

interface RepoOut {
  id: string
  name: string
  remote_url: string | null
}

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ repo: string }>
}) {
  const { repo: repoId } = await params

  let repos: RepoOut[] = []
  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/repos`, {
      cache: "no-store",
    })
    if (res.ok) {
      repos = await res.json()
    }
  } catch {
    redirect("/new")
  }

  const repo = repos.find((r) => r.id === repoId)
  if (!repo) {
    redirect("/")
  }

  return (
    <>
      <AppHeader repo={repo} repos={repos} />
      <div className="pt-11">{children}</div>
    </>
  )
}
