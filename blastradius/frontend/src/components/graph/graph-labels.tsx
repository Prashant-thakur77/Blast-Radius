"use client"

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { CodeUnitNode, ClusterColorMap } from "@/types/graph"

const LABEL_FONT_SIZE = 10
const CLUSTER_LABEL_FONT_SIZE = 20
const MAX_PROXIMITY_LABELS = 3
const MAX_LABEL_DISTANCE = 30

function StaticLabel({ node, textColor, isDark }: { node: CodeUnitNode; textColor: string; isDark: boolean }) {
  const [opacity, setOpacity] = useState(0)
  const fontSize = useMemo(() => LABEL_FONT_SIZE * (typeof window !== "undefined" ? window.devicePixelRatio : 1), [])

  useEffect(() => {
    const timer = setTimeout(() => setOpacity(1), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Html
      position={[node.x3d, node.y3d - 0.6, node.z3d]}
      center
      sprite
      transform
      occlude={false}
      zIndexRange={[100, 0]}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        opacity,
        transition: "opacity 0.5s ease-in-out",
      }}
    >
      <div style={{
        color: textColor,
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        whiteSpace: "nowrap",
        textShadow: isDark
          ? "0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)"
          : "0 0 8px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)",
      }}>
        {node.symbol_name}
      </div>
    </Html>
  )
}

export function NodeLabels({
  nodes,
  clusterColors,
  isDark,
}: {
  nodes: CodeUnitNode[]
  clusterColors: ClusterColorMap
  isDark: boolean
}) {
  const defaultColor = isDark ? "#ffffff" : "#0284c7"

  return (
    <group>
      {nodes.map((n) => {
        const color = n.cluster_label
          ? clusterColors.get(n.cluster_label) ?? defaultColor
          : defaultColor
        return <StaticLabel key={n.id} node={n} textColor={color} isDark={isDark} />
      })}
    </group>
  )
}

function ClusterLabel({ label, position, color, isDark }: { label: string; position: [number, number, number]; color: string; isDark: boolean }) {
  const [opacity, setOpacity] = useState(0)
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1

  useEffect(() => {
    const timer = setTimeout(() => setOpacity(1), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Html
      position={position}
      center
      sprite
      transform
      occlude={false}
      zIndexRange={[110, 0]}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        opacity,
        transition: "opacity 0.5s ease-in-out",
      }}
    >
      <div style={{
        color,
        fontSize: `${CLUSTER_LABEL_FONT_SIZE * dpr}px`,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
        whiteSpace: "nowrap",
        textShadow: isDark
          ? "0 0 12px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9)"
          : "0 0 12px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.9)",
      }}>
        {label}
      </div>
    </Html>
  )
}

export function ClusterLabels({
  nodes,
  clusterColors,
  isDark,
}: {
  nodes: CodeUnitNode[]
  clusterColors: ClusterColorMap
  isDark: boolean
}) {
  const clusters = useMemo(() => {
    const groups = new Map<string, CodeUnitNode[]>()
    for (const n of nodes) {
      if (!n.cluster_label) continue
      const list = groups.get(n.cluster_label)
      if (list) list.push(n)
      else groups.set(n.cluster_label, [n])
    }

    return [...groups.entries()].map(([label, members]) => {
      const x = members.reduce((s, n) => s + n.x3d, 0) / members.length
      const y = members.reduce((s, n) => s + n.y3d, 0) / members.length
      const z = members.reduce((s, n) => s + n.z3d, 0) / members.length
      return {
        label,
        position: [x, y + 1.2, z] as [number, number, number],
        color: clusterColors.get(label) ?? "#ffffff",
      }
    })
  }, [nodes, clusterColors])

  return (
    <group>
      {clusters.map((c) => (
        <ClusterLabel key={c.label} label={c.label} position={c.position} color={c.color} isDark={isDark} />
      ))}
    </group>
  )
}

export function ProximityLabels({
  nodes,
  clusterColors,
  isDark,
}: {
  nodes: CodeUnitNode[]
  clusterColors: ClusterColorMap
  isDark: boolean
}) {
  const defaultColor = isDark ? "#ffffff" : "#0284c7"
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toNode = useMemo(() => new THREE.Vector3(), [])
  const lastUpdateRef = useRef(0)

  useFrame(({ camera, clock }) => {
    const now = clock.getElapsedTime()
    if (now - lastUpdateRef.current < 0.3) return
    lastUpdateRef.current = now

    camera.getWorldDirection(camDir)
    const camPos = camera.position

    const scored: { id: string; score: number; dist: number }[] = []
    for (const n of nodes) {
      toNode.set(n.x3d - camPos.x, n.y3d - camPos.y, n.z3d - camPos.z)
      const dist = toNode.length()
      const forward = toNode.dot(camDir)
      if (forward < 0 || dist > MAX_LABEL_DISTANCE) continue
      const perp = toNode.clone().addScaledVector(camDir, -forward).length()
      scored.push({ id: n.id, score: forward + perp * 2, dist })
    }

    scored.sort((a, b) => a.score - b.score)
    const next = new Set(scored.slice(0, MAX_PROXIMITY_LABELS).map((s) => s.id))

    if (next.size !== visibleIds.size || [...next].some((id) => !visibleIds.has(id))) {
      setVisibleIds(next)
    }
  })

  return (
    <group>
      {nodes
        .filter((n) => visibleIds.has(n.id))
        .map((n) => {
          const color = n.cluster_label
            ? clusterColors.get(n.cluster_label) ?? defaultColor
            : defaultColor
          return <StaticLabel key={n.id} node={n} textColor={color} isDark={isDark} />
        })}
    </group>
  )
}
