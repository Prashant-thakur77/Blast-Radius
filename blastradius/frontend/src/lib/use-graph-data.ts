import { useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { useGraphStore } from "@/store/graph-store"
import type { GraphData } from "@/types/graph"

export function useGraphData(repoId: string, snapshotId: string | null) {
  useEffect(() => {
    if (!snapshotId) return

    let cancelled = false

    apiFetch(`/api/repos/${repoId}/graph?snapshot_id=${snapshotId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GraphData | null) => {
        if (!cancelled && data) {
          useGraphStore.getState().setData(repoId, data)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [repoId, snapshotId])
}
