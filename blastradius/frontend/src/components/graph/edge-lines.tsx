"use client"

import { useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"

const GROW_DURATION = 0.5

interface PreparedEdge {
  start: [number, number, number]
  end: [number, number, number]
  color: string
  opacity: number
  delay: number
}

function AnimatedEdgeRenderer({ edge, progress, color, opacity, isDark }: { edge: PreparedEdge; progress: number; color: string; opacity: number; isDark: boolean }) {
  const endPoint = useMemo(() => {
    const s = edge.start
    const e = edge.end
    return [
      s[0] + (e[0] - s[0]) * progress,
      s[1] + (e[1] - s[1]) * progress,
      s[2] + (e[2] - s[2]) * progress,
    ] as [number, number, number]
  }, [edge, progress])

  return (
    <Line
      points={[edge.start, endPoint]}
      color={color}
      lineWidth={isDark ? 1 : 1.5}
      transparent
      opacity={opacity * progress}
    />
  )
}

export function EdgeLines({
  edges,
  posMap,
  isDark,
  colorMap,
  centerNodeId,
  dimmed,
}: {
  edges: { source: string; target: string }[]
  posMap: Map<string, [number, number, number]>
  isDark: boolean
  colorMap?: Map<string, string>
  centerNodeId?: string
  dimmed?: boolean
}) {
  const geometry = useMemo(() => {
    const distMap = new Map<string, number>()
    if (centerNodeId) {
      distMap.set(centerNodeId, 0)
      const adj = new Map<string, string[]>()
      for (const e of edges) {
        adj.set(e.source, [...(adj.get(e.source) ?? []), e.target])
        adj.set(e.target, [...(adj.get(e.target) ?? []), e.source])
      }
      const queue = [centerNodeId]
      while (queue.length > 0) {
        const id = queue.shift()!
        const d = distMap.get(id)!
        for (const nb of adj.get(id) ?? []) {
          if (!distMap.has(nb)) {
            distMap.set(nb, d + 1)
            queue.push(nb)
          }
        }
      }
    }

    return edges
      .map((e, i) => {
        const src = posMap.get(e.source)
        const tgt = posMap.get(e.target)
        if (!src || !tgt) return null
        const dist = centerNodeId
          ? Math.min(distMap.get(e.source) ?? 999, distMap.get(e.target) ?? 999)
          : i
        const delay = centerNodeId
          ? 1.0 + dist * 0.55
          : 0.2 + i * 0.006
        return {
          start: src,
          end: tgt,
          key: `${e.source}::${e.target}`,
          delay,
        }
      })
      .filter(Boolean) as { start: [number, number, number]; end: [number, number, number]; key: string; delay: number }[]
  }, [edges, posMap, centerNodeId])

  const defaultColor = isDark ? "#ffffff" : "#333333"
  const dimFactor = dimmed ? 0.3 : 1
  const defaultOpacity = (isDark ? 0.15 : 0.5) * dimFactor

  const prepared = useMemo(() => {
    return geometry.map((g) => {
      const hasColor = colorMap?.has(g.key)
      return {
        start: g.start,
        end: g.end,
        color: colorMap?.get(g.key) ?? defaultColor,
        opacity: (hasColor ? (isDark ? 0.5 : 0.85) : defaultOpacity) * dimFactor,
        delay: dimmed ? 0 : g.delay,
      } satisfies PreparedEdge
    })
  }, [geometry, colorMap, defaultColor, defaultOpacity, isDark, dimFactor, dimmed])

  const [progress, setProgress] = useState<number[]>([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anim = useMemo(() => ({ startTime: null as number | null, done: false, values: [] as number[] }), [geometry])

  useEffect(() => {
    anim.values = new Array(geometry.length).fill(0)
    anim.startTime = null
    anim.done = false
    setProgress(anim.values.slice())
  }, [geometry, anim])

  useFrame(({ clock }) => {
    if (prepared.length === 0 || anim.done) return
    if (anim.startTime === null) anim.startTime = clock.getElapsedTime()

    const now = clock.getElapsedTime()
    let changed = false
    let allDone = true

    for (let i = 0; i < prepared.length; i++) {
      if (anim.values[i] >= 1) continue
      allDone = false
      const elapsed = now - anim.startTime - prepared[i].delay
      if (elapsed < 0) continue
      const p = Math.min(1, elapsed / GROW_DURATION)
      if (p !== anim.values[i]) {
        anim.values[i] = p
        changed = true
      }
    }

    if (allDone) anim.done = true
    if (changed) setProgress(anim.values.slice())
  })

  return (
    <>
      {prepared.map((edge, i) => {
        const p = progress[i] ?? 0
        if (p <= 0) return null
        return <AnimatedEdgeRenderer key={i} edge={edge} progress={p} color={edge.color} opacity={edge.opacity} isDark={isDark} />
      })}
    </>
  )
}
