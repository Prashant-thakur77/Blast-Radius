"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MRAnalysisResponse } from "@/types/graph"

const riskColors: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-400",
  medium: "bg-amber-500/20 text-amber-400",
  high: "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400",
}

interface ImpactBannerProps {
  mr: MRAnalysisResponse
  onClose: () => void
}

export function ImpactBanner({ mr, onClose }: ImpactBannerProps) {
  const report = mr.report
  const riskClass = riskColors[report.risk_level] ?? riskColors.low

  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-border bg-background/90 backdrop-blur-md px-3 py-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", riskClass)}>
        {report.risk_level}
      </span>

      <span className="text-[11px] text-foreground/80 truncate">
        {mr.mr_iid ? `MR #${mr.mr_iid}: ` : ""}
        {mr.source_branch} → {mr.target_branch}
      </span>

      <div className="flex items-center gap-2 ml-auto shrink-0 text-[10px] text-muted-foreground">
        <span className="text-red-400">{report.changed_units.length} changed</span>
        <span className="text-amber-400">{report.impacted_units.length} ripple</span>
        <span>{report.cluster_impact.length} clusters</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
