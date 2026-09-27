import { redirect } from "next/navigation"

interface RepoOut {
  id: string
  name: string
  remote_url: string | null
}

export default async function Home() {
  let repos: RepoOut[] = []

  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/repos`, {
      cache: "no-store",
    })
    if (res.ok) {
      repos = await res.json()
    }
  } catch {
    // Backend unavailable — show add repo page
  }

  if (repos.length > 0) {
    redirect(`/${repos[0].id}`)
  }

  redirect("/setup")
}
