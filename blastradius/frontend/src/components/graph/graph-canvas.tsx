"use client"

if (typeof window !== "undefined") {
  const origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return
    origWarn(...args)
  }
}

import { useMemo, useState, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { Stars as DreiStars } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import * as THREE from "three"
import { useTheme } from "next-themes"
import { useGraphData } from "@/lib/use-graph-data"
import { useGraphStore } from "@/store/graph-store"
import { buildClusterColorMap, getIntraClusterEdges, highlightNode, computeDegrees } from "@/lib/graph-utils"
import { GraphToggles, type ToggleKey } from "@/components/graph/graph-toggles"
import { NodeDetailCard } from "@/components/graph/node-detail-card"
import { NodeCloud, HUB_THRESHOLD } from "@/components/graph/node-cloud"
import { NodeLabels, ClusterLabels, ProximityLabels } from "@/components/graph/graph-labels"
import { EdgeLines } from "@/components/graph/edge-lines"
import { CameraRig } from "@/components/graph/camera-rig"
import type { CodeUnitNode, GraphEdge, ClusterColorMap, GraphHighlight, ImpactStatus, MRAnalysisResponse } from "@/types/graph"

interface GraphCanvasProps {
  repoId: string
  snapshotId: string | null
  mrData?: MRAnalysisResponse | null
}

interface SceneProps {
  nodes: CodeUnitNode[]
  edges: GraphEdge[]
  clusterColors: ClusterColorMap
  isDark: boolean
  bgColor: string
  showLabels: boolean
  showEdges: boolean
  showClusters: boolean
  highlight: GraphHighlight | null
  focusNodes: CodeUnitNode[] | null
  onNodeClick: (nodeId: string) => void
  impactMap: Map<string, ImpactStatus> | null
}

function Scene({ nodes, edges, clusterColors, isDark, bgColor, showLabels, showEdges, showClusters, highlight, focusNodes, onNodeClick, impactMap }: SceneProps) {
  const posMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    for (const n of nodes) map.set(n.id, [n.x3d, n.y3d, n.z3d])
    return map
  }, [nodes])

  const clusterEdges = useMemo(
    () => (showClusters ? getIntraClusterEdges(nodes, edges) : []),
    [showClusters, nodes, edges],
  )

  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of clusterEdges) {
      const key = `${e.source}::${e.target}`
      map.set(key, clusterColors.get(e.clusterLabel) ?? "#ffffff")
    }
    return map
  }, [clusterEdges, clusterColors])

  const hubIds = useMemo(() => {
    const set = new Set<string>()
    for (const n of nodes) {
      if (n.hub_score > HUB_THRESHOLD) set.add(n.id)
    }
    return set
  }, [nodes])

  const allEdgeList = useMemo(
    () => edges
      .filter((e) => !hubIds.has(e.source) && !hubIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target })),
    [edges, hubIds],
  )

  const clusterEdgeList = useMemo(
    () => clusterEdges.map((e) => ({ source: e.source, target: e.target })),
    [clusterEdges],
  )

  const { innerEdges, outerEdges, specificEdges } = useMemo(() => {
    if (!highlight) return { innerEdges: [], outerEdges: [], specificEdges: [] }

    const inner: { source: string; target: string }[] = []
    const outer: { source: string; target: string }[] = []
    const specific: { source: string; target: string }[] = []

    if (highlight.edgeKeys.size > 0) {
      for (const e of edges) {
        const key = `${e.source}::${e.target}::${e.edge_type}`
        if (highlight.edgeKeys.has(key)) {
          specific.push({ source: e.source, target: e.target })
        }
      }
    }

    for (const e of edges) {
      const srcIn = highlight.nodeIds.has(e.source)
      const tgtIn = highlight.nodeIds.has(e.target)
      if (srcIn && tgtIn) {
        inner.push({ source: e.source, target: e.target })
      } else if (srcIn || tgtIn) {
        outer.push({ source: e.source, target: e.target })
      }
    }

    return { innerEdges: inner, outerEdges: outer, specificEdges: specific }
  }, [highlight, edges])

  const impactLabelNodes = useMemo(() => {
    if (!impactMap) return []
    return nodes.filter((n) => {
      const status = impactMap.get(n.id)
      return status === "changed" || status === "added"
    })
  }, [impactMap, nodes])

  const affectedIds = useMemo(() => {
    if (!impactMap) return new Set<string>()
    const ids = new Set<string>()
    for (const [id, status] of impactMap) {
      if (status !== "unaffected") ids.add(id)
    }
    return ids
  }, [impactMap])

  const changedIds = useMemo(() => {
    if (!impactMap) return new Set<string>()
    const ids = new Set<string>()
    for (const [id, status] of impactMap) {
      if (status === "changed" || status === "added") ids.add(id)
    }
    return ids
  }, [impactMap])

  const impactEdgeList = useMemo(() => {
    if (!impactMap) return []
    return edges
      .filter((e) => changedIds.has(e.source) || changedIds.has(e.target))
      .filter((e) => affectedIds.has(e.source) && affectedIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }))
  }, [impactMap, edges, affectedIds, changedIds])

  const impactEdgeColorMap = useMemo(() => {
    if (!impactMap) return undefined
    const map = new Map<string, string>()
    for (const e of impactEdgeList) {
      const srcStatus = impactMap.get(e.source) ?? "unaffected"
      const tgtStatus = impactMap.get(e.target) ?? "unaffected"
      const color = (srcStatus === "changed" || tgtStatus === "changed") ? "#ef4444"
        : (srcStatus === "added" || tgtStatus === "added") ? "#22c55e"
        : "#f59e0b"
      map.set(`${e.source}::${e.target}`, color)
    }
    return map
  }, [impactMap, impactEdgeList])

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <ambientLight intensity={isDark ? 0.2 : 1.5} />

      {isDark && (
        <DreiStars radius={200} depth={40} count={5000} factor={4} saturation={0} fade speed={1} />
      )}

      <NodeCloud nodes={nodes} clusterColors={clusterColors} isDark={isDark} highlight={highlight} onNodeClick={onNodeClick} bgColor={bgColor} impactMap={impactMap} />

      {impactMap ? (
        <>
          {showLabels && impactLabelNodes.length > 0 && (
            <NodeLabels nodes={impactLabelNodes} clusterColors={clusterColors} isDark={isDark} />
          )}
          {showEdges && impactEdgeList.length > 0 && (
            <EdgeLines edges={impactEdgeList} posMap={posMap} isDark={isDark} colorMap={impactEdgeColorMap} />
          )}
          {showClusters && (
            <ClusterLabels nodes={nodes.filter((n) => affectedIds.has(n.id))} clusterColors={clusterColors} isDark={isDark} />
          )}
        </>
      ) : !highlight ? (
        <>
          {showLabels ? (
            <NodeLabels nodes={nodes} clusterColors={clusterColors} isDark={isDark} />
          ) : (
            <ProximityLabels nodes={nodes} clusterColors={clusterColors} isDark={isDark} />
          )}

          {showEdges && (
            <EdgeLines edges={allEdgeList} posMap={posMap} isDark={isDark} />
          )}

          {showClusters && (
            <>
              <ClusterLabels nodes={nodes} clusterColors={clusterColors} isDark={isDark} />
              {clusterEdgeList.length > 0 && (
                <EdgeLines edges={clusterEdgeList} posMap={posMap} isDark={isDark} colorMap={clusterColorMap} />
              )}
            </>
          )}
        </>
      ) : (
        <>
          {specificEdges.length > 0 && (
            <EdgeLines edges={specificEdges} posMap={posMap} isDark={isDark} centerNodeId={focusNodes?.[0]?.id} />
          )}
          {specificEdges.length === 0 && innerEdges.length > 0 && (
            <EdgeLines edges={innerEdges} posMap={posMap} isDark={isDark} centerNodeId={focusNodes?.[0]?.id} />
          )}
          {outerEdges.length > 0 && (
            <EdgeLines edges={outerEdges} posMap={posMap} isDark={isDark} dimmed />
          )}
          <NodeLabels
            nodes={nodes.filter((n) => highlight.nodeIds.has(n.id))}
            clusterColors={clusterColors}
            isDark={isDark}
          />
        </>
      )}

      <CameraRig nodes={nodes} focusNodes={focusNodes} />
    </>
  )
}

export function GraphCanvas({ repoId, snapshotId, mrData }: GraphCanvasProps) {
  useGraphData(repoId, snapshotId)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const repo = useGraphStore((s) => s.repos[repoId])
  const data = repo?.data ?? null
  const bgColor = isDark ? "#0a0a0a" : "#ffffff"

  const [showLabels, setShowLabels] = useState(false)
  const [showEdges, setShowEdges] = useState(false)
  const [showClusters, setShowClusters] = useState(false)

  const selectedNodeId = repo?.selectedNodeId ?? null
  const highlight = repo?.highlight ?? null


  const clusterColors = useMemo(
    () => (data ? buildClusterColorMap(data.nodes, isDark) : new Map<string, string>()),
    [data, isDark],
  )

  const clusterCount = useMemo(() => {
    if (!data) return 0
    return new Set(data.nodes.map((n) => n.cluster_label).filter(Boolean)).size
  }, [data])

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [data, selectedNodeId])

  const degrees = useMemo(() => {
    if (!data) return new Map<string, { in: number; out: number }>()
    return computeDegrees(data.edges)
  }, [data])

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!data) return
    useGraphStore.getState().selectNode(repoId, nodeId)
    useGraphStore.getState().setHighlight(repoId, highlightNode(data, nodeId, 1))
  }, [repoId, data])

  const handleReset = useCallback(() => {
    useGraphStore.getState().selectNode(repoId, null)
    useGraphStore.getState().setHighlight(repoId, null)
  }, [repoId])

  const handleToggle = useCallback((key: ToggleKey) => {
    if (key === "labels") setShowLabels((v) => !v)
    if (key === "edges") {
      setShowEdges((v) => !v)
      setShowClusters(false)
    }
    if (key === "clusters") {
      setShowClusters((v) => !v)
      setShowEdges(false)
    }
  }, [])

  const impactMap = useMemo(() => {
    if (!mrData?.report.overlay_graph) return null
    const map = new Map<string, ImpactStatus>()
    for (const n of mrData.report.overlay_graph.nodes) {
      map.set(n.id, n.impact_status)
    }
    return map
  }, [mrData])

  const isImpactMode = !!impactMap

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        Loading graph...
      </div>
    )
  }

  const nodeDeg = selectedNode ? degrees.get(selectedNode.id) : undefined

  return (
    <div className="flex-1 relative bg-background">
      <GraphToggles
        nodeCount={isImpactMode ? (mrData?.report.changed_units.length ?? 0) : data.nodes.length}
        edgeCount={isImpactMode ? (mrData?.report.impacted_units.length ?? 0) : data.edges.length}
        clusterCount={isImpactMode ? (mrData?.report.cluster_impact.length ?? 0) : clusterCount}
        showLabels={showLabels}
        showEdges={showEdges}
        showClusters={showClusters}
        onToggle={handleToggle}
        isHighlighted={!isImpactMode && !!highlight}
        highlightLabel={selectedNode?.symbol_name}
        onReset={handleReset}
      />
      {selectedNode && (
        <NodeDetailCard
          node={selectedNode}
          clusterColor={selectedNode.cluster_label ? clusterColors.get(selectedNode.cluster_label) : undefined}
          inDegree={nodeDeg?.in ?? 0}
          outDegree={nodeDeg?.out ?? 0}
          onClose={handleReset}
        />
      )}
      <Canvas
        camera={{ position: [0, 0, 0], near: 0.01, far: 1000 }}
        gl={{
          antialias: true,
          toneMapping: isDark ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping,
          toneMappingExposure: 1,
        }}
      >
        <Scene
          nodes={data.nodes}
          edges={data.edges}
          clusterColors={clusterColors}
          isDark={isDark}
          bgColor={bgColor}
          showLabels={showLabels}
          showEdges={showEdges}
          showClusters={showClusters}
          highlight={highlight}
          focusNodes={selectedNode ? [selectedNode] : highlight ? data.nodes.filter((n) => highlight.nodeIds.has(n.id)) : null}
          onNodeClick={handleNodeClick}
          impactMap={impactMap}
        />
        <EffectComposer>
          <Bloom
            kernelSize={5}
            luminanceThreshold={isDark ? 0.0 : 0.8}
            luminanceSmoothing={0.5}
            intensity={0.75}
            radius={isDark ? 0.5 : 0.6}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
