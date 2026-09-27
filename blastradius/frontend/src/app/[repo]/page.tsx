"use client"

import { useParams, useSearchParams } from "next/navigation"
import { RepoView } from "@/components/repo-view"

export default function RepoPage() {
  const { repo: repoId } = useParams<{ repo: string }>()
  const searchParams = useSearchParams()
  const initialSnapshotId = searchParams.get("s") ?? undefined
  const mrId = searchParams.get("mr") ?? undefined

  return <RepoView repoId={repoId} initialSnapshotId={initialSnapshotId} mrId={mrId} />
}
