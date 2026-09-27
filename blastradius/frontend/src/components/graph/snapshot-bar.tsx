"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MRAnalysisResponse } from "@/types/graph"

interface SnapshotInfo {
  id: string
  commit_sha: string
  commit_message: string
  commit_time: string
  unit_count: number
  edge_count: number
}

interface SnapshotBarProps {
  repoId: string
  snapshotId?: string | null
  mrData?: MRAnalysisResponse | null
  onMRClose?: () => void
}

const riskStyle: Record<string, string> = {
  low: "bg-emerald-950 text-emerald-400",
  medium: "bg-amber-950 text-amber-400",
  high: "bg-orange-950 text-orange-400",
  critical: "bg-red-950 text-red-400",
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function SnapshotBar({ repoId, snapshotId, mrData, onMRClose }: SnapshotBarProps) {
  const [snap, setSnap] = useState<SnapshotInfo | null>(null)

  useEffect(() => {
    fetch(`/api/repos/${repoId}/snapshots`)
      .then((r) => (r.ok ? r.json() : []))
      .then((snapshots: SnapshotInfo[]) => {
        if (snapshots.length === 0) return
        const target = snapshotId
          ? snapshots.find((s) => s.id === snapshotId)
          : snapshots[snapshots.length - 1]
        setSnap(target ?? snapshots[snapshots.length - 1])
      })
      .catch(() => {})
  }, [repoId, snapshotId])

  if (mrData) {
    const r = mrData.report
    return (
      <div className="shrink-0 flex items-center gap-2 px-3 border-b border-border h-[32px]">
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0", riskStyle[r.risk_level] ?? riskStyle.low)}>
          {r.risk_level}
        </span>
        <span className="text-[11px] text-foreground/80 truncate">
          {mrData.source_branch} → {mrData.target_branch}
        </span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {r.changed_units.length} changed
        </span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {r.impacted_units.length} ripple
        </span>
        <button
          type="button"
          onClick={onMRClose}
          className="ml-auto shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 flex items-center gap-2.5 px-3 border-b border-border h-[32px]">
      {!snap ? null : (<>
      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
        {snap.commit_sha.slice(0, 7)}
      </span>
      <span className="text-[12px] text-foreground/80 truncate">
        {snap.commit_message}
      </span>
      <span className="text-[11px] text-muted-foreground/50 shrink-0 ml-auto">
        {relativeTime(snap.commit_time)}
      </span>
      </>)}
    </div>
  )
}
