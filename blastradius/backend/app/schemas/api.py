from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import EdgeType


class RepoCreate(BaseModel):
    name: str
    url: str
    source_root: str | None = None


class RepoOut(BaseModel):
    id: str
    name: str
    remote_url: str | None
    source_root: str | None = None
    welcome_message: str | None = None


class SnapshotSummary(BaseModel):
    id: str
    commit_sha: str
    commit_message: str
    commit_time: str
    branch_name: str | None
    parent_snapshot_id: str | None = None
    unit_count: int = 0
    edge_count: int = 0
    units_added: int = 0
    units_modified: int = 0
    units_removed: int = 0


class IngestResult(BaseModel):
    snapshots_created: int
    latest_snapshot_id: str | None


class CodeUnitOut(BaseModel):
    id: str
    qualname: str
    symbol_name: str
    file_path: str
    kind: str
    runtime: str
    start_line: int
    end_line: int
    llm_description: str | None
    cluster_label: str | None = None
    hub_score: float = 0.0
    x2d: float = 0.0
    y2d: float = 0.0
    x3d: float = 0.0
    y3d: float = 0.0
    z3d: float = 0.0


class GraphEdgeOut(BaseModel):
    source: str
    target: str
    edge_type: EdgeType


class GraphOut(BaseModel):
    snapshot_id: str
    commit_sha: str
    nodes: list[CodeUnitOut]
    edges: list[GraphEdgeOut]


class ChangedFile(BaseModel):
    path: str
    content: str | None = None
    status: str  # added | modified | deleted


class AnalyzeMRRequest(BaseModel):
    mr_iid: int | None = None
    source_branch: str | None = None
    target_branch: str = "main"
    changed_files: list[ChangedFile] = []


class ChangedUnit(BaseModel):
    qualname: str
    symbol_name: str
    file_path: str
    kind: str
    cluster_label: str | None
    change_type: str
    llm_description: str | None


class ImpactedUnit(BaseModel):
    qualname: str
    symbol_name: str
    file_path: str
    kind: str
    cluster_label: str | None
    edge_type: str
    distance: int
    llm_description: str | None


class ClusterImpact(BaseModel):
    cluster: str
    impact_score: float
    changed_count: int
    ripple_count: int
    total_count: int


class GraphDiffOut(BaseModel):
    added_nodes: list[str]
    removed_nodes: list[str]
    modified_nodes: list[str]
    added_edges: list[GraphEdgeOut]
    removed_edges: list[GraphEdgeOut]


class OverlayNode(BaseModel):
    id: str
    qualname: str
    symbol_name: str
    file_path: str
    kind: str
    runtime: str
    x2d: float = 0.0
    y2d: float = 0.0
    x3d: float = 0.0
    y3d: float = 0.0
    z3d: float = 0.0
    llm_description: str | None = None
    cluster_label: str | None = None
    impact_status: str  # changed | added | deleted | ripple | unaffected


class OverlayGraph(BaseModel):
    nodes: list[OverlayNode]
    edges: list[GraphEdgeOut]


class ImpactReport(BaseModel):
    mr_iid: int | None = None
    risk_level: str
    changed_units: list[ChangedUnit]
    impacted_units: list[ImpactedUnit]
    cluster_impact: list[ClusterImpact]
    suggested_labels: list[str]
    graph_diff: GraphDiffOut
    overlay_graph: OverlayGraph | None = None


class SearchRequest(BaseModel):
    query: str | None = None
    queries: list[str] | None = None
    snapshot_id: str | None = None
    top_k: int = 10


class SearchNeighbor(BaseModel):
    id: str
    qualname: str
    symbol_name: str
    kind: str
    llm_description: str | None = None
    edge_type: str
    direction: str


class SearchResult(BaseModel):
    id: str
    qualname: str
    symbol_name: str
    file_path: str
    kind: str
    llm_description: str | None = None
    similarity: float
    neighbors: list[SearchNeighbor]


class SearchResponse(BaseModel):
    results: list[SearchResult]


class TraverseRequest(BaseModel):
    seed_ids: list[str]
    mode: str = "connect"
    snapshot_id: str | None = None
    max_depth: int = 3
    max_nodes: int = 30
    direction: str = "both"


class TraverseNode(BaseModel):
    id: str
    qualname: str
    symbol_name: str
    file_path: str
    kind: str
    llm_description: str | None = None
    is_seed: bool = False


class TraverseEdge(BaseModel):
    source_id: str
    target_id: str
    source_qualname: str
    target_qualname: str
    edge_type: str


class TraverseResponse(BaseModel):
    nodes: list[TraverseNode]
    edges: list[TraverseEdge]


class SyncResult(BaseModel):
    snapshots_created: int
    branches_synced: list[str]
    url: str


class MRAnalysisSummary(BaseModel):
    id: str
    mr_iid: int | None
    source_branch: str
    target_branch: str
    risk_level: str
    status: str
    created_at: str


class MRAnalysisResponse(BaseModel):
    id: str
    mr_iid: int | None
    source_branch: str
    target_branch: str
    risk_level: str
    status: str
    url: str
    report: ImpactReport


class AnalyzeByURLRequest(BaseModel):
    repo_url: str
    repo_name: str = ""
    source_root: str | None = None
    source_branch: str
    target_branch: str = "main"
    mr_iid: int | None = None


class SyncByURLRequest(BaseModel):
    repo_url: str
