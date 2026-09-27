"use client"

import { X } from "lucide-react"
import type { CodeUnitNode } from "@/types/graph"

interface NodeDetailCardProps {
  node: CodeUnitNode
  clusterColor?: string
  inDegree: number
  outDegree: number
  onClose: () => void
}

const kindLabel: Record<string, string> = {
  function: "fn",
  component: "cmp",
  hook: "hook",
  api_handler: "api",
}

const runtimeLabel: Record<string, string> = {
  client: "client",
  server: "server",
  shared: "shared",
}

export function NodeDetailCard({ node, clusterColor, inDegree, outDegree, onClose }: NodeDetailCardProps) {
  return (
    <div className="absolute bottom-4 left-4 z-20 w-[380px] rounded-lg border border-border bg-background/90 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-2 p-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold truncate">{node.symbol_name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {kindLabel[node.kind] ?? node.kind}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {runtimeLabel[node.runtime] ?? node.runtime}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-1 truncate">
            {node.file_path}:{node.start_line}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {node.llm_description && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-foreground/70 leading-relaxed">
            {node.llm_description}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 px-3 pb-3 text-[10px] text-muted-foreground">
        {node.cluster_label && (
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: clusterColor }}
            />
            {node.cluster_label}
          </span>
        )}
        <span>{inDegree} in</span>
        <span>{outDegree} out</span>
        {node.hub_score > 0.1 && (
          <span>hub {(node.hub_score * 100).toFixed(0)}%</span>
        )}
      </div>
    </div>
  )
}
