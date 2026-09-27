"use client"

import { useRef, useEffect } from "react"
import { CameraControls } from "@react-three/drei"
import type { CodeUnitNode } from "@/types/graph"

function computeFraming(nodes: CodeUnitNode[]) {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const n of nodes) {
    if (n.x3d < minX) minX = n.x3d
    if (n.y3d < minY) minY = n.y3d
    if (n.z3d < minZ) minZ = n.z3d
    if (n.x3d > maxX) maxX = n.x3d
    if (n.y3d > maxY) maxY = n.y3d
    if (n.z3d > maxZ) maxZ = n.z3d
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  const distance = Math.max(20, span * 1)
  return { cx, cy, cz, distance }
}

export function CameraRig({ nodes, focusNodes }: { nodes: CodeUnitNode[]; focusNodes: CodeUnitNode[] | null }) {
  const controlsRef = useRef<CameraControls>(null)
  const initialDone = useRef(false)
  const homeRef = useRef({ cx: 0, cy: 0, cz: 0, distance: 45 })

  useEffect(() => {
    if (!controlsRef.current || nodes.length === 0) return
    if (initialDone.current) return
    initialDone.current = true
    const f = computeFraming(nodes)
    homeRef.current = f
    const timer = setTimeout(() => {
      controlsRef.current?.setLookAt(f.cx, f.cy, f.cz + f.distance, f.cx, f.cy, f.cz, true)
    }, 80)
    return () => clearTimeout(timer)
  }, [nodes])

  useEffect(() => {
    if (!controlsRef.current) return

    if (focusNodes && focusNodes.length > 0) {
      const f = computeFraming(focusNodes)
      controlsRef.current.setLookAt(f.cx, f.cy, f.cz + f.distance, f.cx, f.cy, f.cz, true)
    } else if (initialDone.current) {
      const h = homeRef.current
      controlsRef.current.setLookAt(h.cx, h.cy, h.cz + h.distance, h.cx, h.cy, h.cz, true)
    }
  }, [focusNodes])

  return <CameraControls ref={controlsRef} smoothTime={0.8} minDistance={5} maxDistance={200} />
}
