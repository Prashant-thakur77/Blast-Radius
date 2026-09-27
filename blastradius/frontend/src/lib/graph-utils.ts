import type {
  GraphData,
  GraphEdge,
  GraphHighlight,
  CodeUnitNode,
  ClusterColorMap,
} from "@/types/graph"
import type { Flow } from "@/lib/parse-flow-blocks"

const GOLDEN_ANGLE = 137.508

export function edgeKey(e: GraphEdge): string {
  return `${e.source}::${e.target}::${e.edge_type}`
}

export function buildAdjacency(edges: GraphEdge[]) {
  const outgoing = new Map<string, GraphEdge[]>()
  const incoming = new Map<string, GraphEdge[]>()

  for (const e of edges) {
    const out = outgoing.get(e.source)
    if (out) out.push(e)
    else outgoing.set(e.source, [e])

    const inc = incoming.get(e.target)
    if (inc) inc.push(e)
    else incoming.set(e.target, [e])
  }

  return { outgoing, incoming }
}

function collectNeighbors(
  edges: GraphEdge[],
  seedIds: Set<string>,
  depth: number,
): { nodeIds: Set<string>; edgeKeys: Set<string> } {
  const nodeIds = new Set(seedIds)
  const collectedEdges = new Set<string>()
  const { outgoing, incoming } = buildAdjacency(edges)

  let frontier = new Set(seedIds)

  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const id of frontier) {
      for (const e of outgoing.get(id) ?? []) {
        collectedEdges.add(edgeKey(e))
        if (!nodeIds.has(e.target)) {
          nodeIds.add(e.target)
          next.add(e.target)
        }
      }
      for (const e of incoming.get(id) ?? []) {
        collectedEdges.add(edgeKey(e))
        if (!nodeIds.has(e.source)) {
          nodeIds.add(e.source)
          next.add(e.source)
        }
      }
    }
    frontier = next
    if (frontier.size === 0) break
  }

  return { nodeIds, edgeKeys: collectedEdges }
}

export function highlightNode(
  data: GraphData,
  nodeId: string,
  depth = 1,
): GraphHighlight {
  const { nodeIds, edgeKeys } = collectNeighbors(
    data.edges,
    new Set([nodeId]),
    depth,
  )
  return { source: "graph", nodeIds, edgeKeys }
}

export function highlightFile(
  data: GraphData,
  filePath: string,
): GraphHighlight {
  const seedIds = new Set(
    data.nodes.filter((n) => n.file_path === filePath).map((n) => n.id),
  )
  const { nodeIds, edgeKeys } = collectNeighbors(data.edges, seedIds, 1)
  return { source: "explorer", nodeIds, edgeKeys }
}

export function highlightFlow(flow: Flow): GraphHighlight {
  const nodeIds = new Set(flow.node_ids)
  const edgeKeys = new Set(
    (flow.edge_keys ?? []).map(
      (ek) => `${ek.source}::${ek.target}::${ek.edge_type}`,
    ),
  )
  return { source: "chat", nodeIds, edgeKeys }
}

const labelHueCache = new Map<string, number>()

export function buildClusterColorMap(
  nodes: CodeUnitNode[],
  isDark = true,
): ClusterColorMap {
  const labels = [
    ...new Set(
      nodes.map((n) => n.cluster_label).filter((l): l is string => l !== null),
    ),
  ].sort()

  for (const label of labels) {
    if (!labelHueCache.has(label)) {
      labelHueCache.set(label, (labelHueCache.size * GOLDEN_ANGLE) % 360)
    }
  }

  const map: ClusterColorMap = new Map()
  for (const label of labels) {
    const hue = labelHueCache.get(label)!
    const lightness = isDark
      ? 65
      : hue > 30 && hue < 90 ? 45 : 47
    map.set(label, `hsl(${hue}, 100%, ${lightness}%)`)
  }
  return map
}

export interface ClusterEdge {
  source: string
  target: string
  edge_type: string
  clusterLabel: string
}

export function getIntraClusterEdges(
  nodes: CodeUnitNode[],
  edges: GraphEdge[],
): ClusterEdge[] {
  const nodeCluster = new Map<string, string>()
  for (const n of nodes) {
    if (n.cluster_label) nodeCluster.set(n.id, n.cluster_label)
  }

  const result: ClusterEdge[] = []
  for (const e of edges) {
    const srcCluster = nodeCluster.get(e.source)
    const tgtCluster = nodeCluster.get(e.target)
    if (srcCluster && tgtCluster && srcCluster === tgtCluster) {
      result.push({
        source: e.source,
        target: e.target,
        edge_type: e.edge_type,
        clusterLabel: srcCluster,
      })
    }
  }
  return result
}

export function computeDegrees(
  edges: GraphEdge[],
): Map<string, { in: number; out: number }> {
  const degrees = new Map<string, { in: number; out: number }>()

  const ensure = (id: string) => {
    if (!degrees.has(id)) degrees.set(id, { in: 0, out: 0 })
    return degrees.get(id)!
  }

  for (const e of edges) {
    ensure(e.source).out++
    ensure(e.target).in++
  }

  return degrees
}
