export type NodeKind = "function" | "component" | "hook" | "api_handler"
export type EdgeType = "calls" | "http_calls" | "renders"
export type ClusterColorMap = Map<string, string>

export interface CodeUnitNode {
  id: string
  qualname: string
  symbol_name: string
  file_path: string
  kind: string
  runtime: string
  start_line: number
  end_line: number
  llm_description: string | null
  cluster_label: string | null
  hub_score: number
  x2d: number
  y2d: number
  x3d: number
  y3d: number
  z3d: number
}

export interface GraphEdge {
  source: string
  target: string
  edge_type: EdgeType
}

export interface GraphData {
  snapshot_id: string
  commit_sha: string
  nodes: CodeUnitNode[]
  edges: GraphEdge[]
}

export type HighlightSource = "explorer" | "graph" | "chat" | "impact"

export interface GraphHighlight {
  source: HighlightSource
  nodeIds: Set<string>
  edgeKeys: Set<string>
}

export type ImpactStatus = "changed" | "added" | "deleted" | "ripple" | "unaffected"

export interface OverlayNode {
  id: string
  qualname: string
  symbol_name: string
  file_path: string
  kind: string
  runtime: string
  x2d: number
  y2d: number
  x3d: number
  y3d: number
  z3d: number
  llm_description: string | null
  cluster_label: string | null
  impact_status: ImpactStatus
}

export interface ClusterImpact {
  cluster: string
  impact_score: number
  changed_count: number
  ripple_count: number
  total_count: number
}

export interface ImpactReport {
  mr_iid: number | null
  risk_level: string
  changed_units: { qualname: string; symbol_name: string; file_path: string; kind: string; change_type: string }[]
  impacted_units: { qualname: string; symbol_name: string; file_path: string; kind: string; distance: number }[]
  cluster_impact: ClusterImpact[]
  suggested_labels: string[]
  overlay_graph: { nodes: OverlayNode[]; edges: GraphEdge[] } | null
}

export interface MRAnalysisResponse {
  id: string
  mr_iid: number | null
  source_branch: string
  target_branch: string
  risk_level: string
  status: string
  url: string
  report: ImpactReport
}
