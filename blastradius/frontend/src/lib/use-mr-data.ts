import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import type { MRAnalysisResponse } from "@/types/graph"

export function useMRData(repoId: string, mrId: string | null): MRAnalysisResponse | null {
  const [data, setData] = useState<MRAnalysisResponse | null>(null)

  useEffect(() => {
    if (!mrId) {
      setData(null)
      return
    }

    let cancelled = false

    apiFetch(`/api/repos/${repoId}/mrs/${mrId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MRAnalysisResponse | null) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [repoId, mrId])

  return data
}
