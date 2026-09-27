"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface SnapshotSummary {
  id: string
  commit_sha: string
  commit_message: string
  commit_time: string
  branch_name: string | null
  parent_snapshot_id: string | null
  unit_count: number
  edge_count: number
  units_added: number
  units_modified: number
  units_removed: number
}

interface MRSummary {
  id: string
  mr_iid: number | null
  source_branch: string
  risk_level: string
  status: string
}

interface HistoryPanelProps {
  repoId: string
  activeSnapshotId: string | null
  activeMRId?: string | null
  onSelect: (snapshotId: string) => void
  onMRClick?: (mrId: string) => void
}

interface LayoutNode {
  snap: SnapshotSummary
  col: number
  row: number
}

const CARD_W = 112
const CARD_H = 72
const COL_GAP = 16
const ROW_GAP = 16
const COL_STRIDE = CARD_W + COL_GAP
const ROW_STRIDE = CARD_H + ROW_GAP
const GRAPH_SIDE_PAD = 14
const GRAPH_TOP_PAD = 12
const REVEAL_TOTAL_MS = 520
const REVEAL_ITEM_MS = 260

function deepestDepth(nodeId: string, childrenMap: Map<string, string[]>): number {
  const children = childrenMap.get(nodeId) ?? []
  if (children.length === 0) return 0
  let max = 0
  for (const cid of children) {
    max = Math.max(max, 1 + deepestDepth(cid, childrenMap))
  }
  return max
}

function findTrunkPath(rootId: string, childrenMap: Map<string, string[]>, snapMap: Map<string, SnapshotSummary>): string[] {
  const path: string[] = []
  let cur = rootId
  while (true) {
    path.push(cur)
    const children = childrenMap.get(cur) ?? []
    if (children.length === 0) break
    const mainChild = children.find((id) => snapMap.get(id)?.branch_name === "main")
    if (mainChild) {
      cur = mainChild
      continue
    }
    break
  }
  return path
}

function placeBranch(
  nodeId: string,
  col: number,
  cursor: { row: number },
  childrenMap: Map<string, string[]>,
  snapMap: Map<string, SnapshotSummary>,
  layoutMap: Map<string, LayoutNode>,
) {
  const snap = snapMap.get(nodeId)
  if (!snap) return
  layoutMap.set(nodeId, { snap, col, row: cursor.row++ })
  const children = childrenMap.get(nodeId) ?? []
  if (children.length === 0) return
  if (children.length === 1) {
    placeBranch(children[0], col, cursor, childrenMap, snapMap, layoutMap)
    return
  }
  let mainChild = children[0]
  let mainDepth = deepestDepth(children[0], childrenMap)
  for (let i = 1; i < children.length; i++) {
    const d = deepestDepth(children[i], childrenMap)
    if (d > mainDepth) { mainDepth = d; mainChild = children[i] }
  }
  placeBranch(mainChild, col, cursor, childrenMap, snapMap, layoutMap)
  const others = children.filter((id) => id !== mainChild)
  for (let i = 0; i < others.length; i++) {
    const subCol = col < 0 ? col - (i + 1) : col + (i + 1)
    placeBranch(others[i], subCol, cursor, childrenMap, snapMap, layoutMap)
  }
}

function computeLayout(snapshots: SnapshotSummary[]): LayoutNode[] {
  if (snapshots.length === 0) return []

  const snapMap = new Map(snapshots.map((s) => [s.id, s]))
  const childrenMap = new Map<string, string[]>()
  const hasParent = new Set<string>()

  for (const s of snapshots) {
    if (s.parent_snapshot_id && snapMap.has(s.parent_snapshot_id)) {
      hasParent.add(s.id)
      const siblings = childrenMap.get(s.parent_snapshot_id) ?? []
      siblings.push(s.id)
      childrenMap.set(s.parent_snapshot_id, siblings)
    }
  }

  const rootId = snapshots.find((s) => !hasParent.has(s.id))?.id ?? snapshots[0].id
  const trunkPath = findTrunkPath(rootId, childrenMap, snapMap)
  const trunkSet = new Set(trunkPath)
  const layoutMap = new Map<string, LayoutNode>()
  const cursor = { row: 0 }
  let dirToggle = 0

  for (const nodeId of trunkPath) {
    const snap = snapMap.get(nodeId)
    if (snap) layoutMap.set(nodeId, { snap, col: 0, row: cursor.row++ })

    const children = childrenMap.get(nodeId) ?? []
    const sideChildren = children.filter((id) => !trunkSet.has(id))
    if (sideChildren.length === 0) continue

    if (sideChildren.length === 1) {
      const dir = dirToggle % 2 === 0 ? -1 : 1
      dirToggle++
      placeBranch(sideChildren[0], dir, cursor, childrenMap, snapMap, layoutMap)
    } else {
      for (let i = 0; i < sideChildren.length; i++) {
        const dir = i % 2 === 0 ? -1 : 1
        placeBranch(sideChildren[i], dir, cursor, childrenMap, snapMap, layoutMap)
      }
      dirToggle += sideChildren.length
    }
  }

  return Array.from(layoutMap.values()).sort((a, b) => a.row - b.row)
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function revealDelay(row: number, totalRows: number): number {
  if (totalRows <= 1) return 0
  const budget = Math.max(0, REVEAL_TOTAL_MS - REVEAL_ITEM_MS)
  return Math.round((row / (totalRows - 1)) * budget)
}

function DeltaBadges({ snap }: { snap: SnapshotSummary }) {
  const { units_added, units_modified, units_removed } = snap
  if (units_added === 0 && units_modified === 0 && units_removed === 0) {
    return <span className="text-muted-foreground/70">initial</span>
  }
  return (
    <span className="flex items-center gap-1">
      {units_added > 0 && (
        <span className="rounded-sm bg-emerald-500/10 px-1 font-semibold text-emerald-700 dark:text-emerald-300">
          +{units_added}
        </span>
      )}
      {units_modified > 0 && (
        <span className="rounded-sm bg-indigo-500/12 px-1 font-semibold text-indigo-700 dark:text-indigo-300">
          ~{units_modified}
        </span>
      )}
      {units_removed > 0 && (
        <span className="rounded-sm bg-rose-500/10 px-1 font-semibold text-rose-700 dark:text-rose-300">
          -{units_removed}
        </span>
      )}
    </span>
  )
}

export function HistoryPanel({ repoId, activeSnapshotId, activeMRId, onSelect, onMRClick }: HistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [mrs, setMrs] = useState<MRSummary[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    fetch(`/api/repos/${repoId}/snapshots`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSnapshots)
      .catch(() => setSnapshots([]))
    fetch(`/api/repos/${repoId}/mrs`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMrs)
      .catch(() => setMrs([]))
  }, [repoId])

  const branchMR = useMemo(() => {
    const map = new Map<string, MRSummary>()
    for (const mr of mrs) {
      map.set(mr.source_branch, mr)
    }
    return map
  }, [mrs])

  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (snapshots.length > 0 && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
      })
    }
  }, [snapshots])

  const layout = useMemo(() => computeLayout(snapshots), [snapshots])
  const activeId = activeSnapshotId ?? (activeMRId ? null : (() => {
    const main = snapshots.filter((s) => s.branch_name === "main")
    return main.length > 0 ? main[main.length - 1].id : snapshots[snapshots.length - 1]?.id ?? null
  })())

  const { minCol, maxCol, totalRows } = useMemo(() => {
    let min = 0, max = 0, maxRow = 0
    for (const ln of layout) {
      if (ln.col < min) min = ln.col
      if (ln.col > max) max = ln.col
      if (ln.row > maxRow) maxRow = ln.row
    }
    return { minCol: min, maxCol: max, totalRows: maxRow + 1 }
  }, [layout])

  const centerX = Math.abs(minCol) * COL_STRIDE
  const totalW = (maxCol - minCol + 1) * COL_STRIDE - COL_GAP
  const totalH = totalRows * ROW_STRIDE - (totalRows > 0 ? ROW_GAP : 0)

  const nodeMap = useMemo(
    () => new Map(layout.map((ln) => [ln.snap.id, ln])),
    [layout],
  )

  const activePath = useMemo(() => {
    const set = new Set<string>()
    const snapMap = new Map(snapshots.map((s) => [s.id, s]))
    let cur: string | null = activeId
    while (cur) {
      set.add(cur)
      cur = snapMap.get(cur)?.parent_snapshot_id ?? null
    }
    return set
  }, [snapshots, activeId])

  function nodeX(col: number) { return centerX + col * COL_STRIDE }
  function nodeY(row: number) { return row * ROW_STRIDE }
  function cardCenterX(col: number) { return nodeX(col) + CARD_W / 2 }
  function cardBottom(row: number) { return nodeY(row) + CARD_H }
  function cardTop(row: number) { return nodeY(row) }

  const connectors = useMemo(() => {
    const paths: React.ReactNode[] = []
    const R = 8

    for (const ln of layout) {
      if (!ln.snap.parent_snapshot_id) continue
      const parentLn = nodeMap.get(ln.snap.parent_snapshot_id)
      if (!parentLn) continue

      const pCx = cardCenterX(parentLn.col)
      const pBottom = cardBottom(parentLn.row)
      const cCx = cardCenterX(ln.col)
      const cTop = cardTop(ln.row)
      const onActive = activePath.has(ln.snap.id) && activePath.has(ln.snap.parent_snapshot_id)
      const delay = revealDelay(ln.row, totalRows)

      if (parentLn.col === ln.col) {
        paths.push(
          <line
            key={`conn-${ln.snap.id}`}
            x1={pCx} y1={pBottom} x2={cCx} y2={cTop}
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinecap="round"
            className={cn(onActive ? "text-primary/55" : "text-border", "history-connector-reveal")}
            style={{ animationDelay: `${delay}ms`, animationDuration: `${REVEAL_ITEM_MS}ms` }}
          />,
        )
      } else {
        const midY = pBottom + (cTop - pBottom) / 2
        const dx = cCx > pCx ? 1 : -1
        const r = Math.min(R, Math.abs(cCx - pCx) / 2, (cTop - pBottom) / 4)
        const d = [
          `M ${pCx} ${pBottom}`,
          `L ${pCx} ${midY - r}`,
          `Q ${pCx} ${midY} ${pCx + dx * r} ${midY}`,
          `L ${cCx - dx * r} ${midY}`,
          `Q ${cCx} ${midY} ${cCx} ${midY + r}`,
          `L ${cCx} ${cTop}`,
        ].join(" ")

        paths.push(
          <path
            key={`conn-${ln.snap.id}`}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinecap="round"
            className={cn(onActive ? "text-primary/55" : "text-border", "history-connector-reveal")}
            style={{ animationDelay: `${delay}ms`, animationDuration: `${REVEAL_ITEM_MS}ms` }}
          />,
        )
      }
    }
    return paths
  }, [layout, nodeMap, activePath, totalRows])

  if (snapshots.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/50 text-center py-4">
        No snapshots yet
      </p>
    )
  }

  const graphBaseWidth = totalW + GRAPH_SIDE_PAD * 2
  const graphBaseHeight = totalH + GRAPH_TOP_PAD + 24
  const fitScale = Math.min(1, containerWidth > 0 ? containerWidth / Math.max(1, graphBaseWidth) : 1)
  const canvasWidth = graphBaseWidth * fitScale
  const canvasHeight = graphBaseHeight * fitScale

  return (
    <div
      ref={scrollRef}
      className="w-full min-w-0 overflow-x-hidden overflow-y-auto px-3 py-2"
    >
      <div className="flex w-full min-h-full justify-center">
        <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
          <div
            className="relative"
            style={{
              width: graphBaseWidth,
              height: graphBaseHeight,
              transform: `scale(${fitScale})`,
              transformOrigin: "top left",
            }}
          >
            <div className="absolute" style={{ top: GRAPH_TOP_PAD, left: GRAPH_SIDE_PAD }}>
              <div className="relative" style={{ width: totalW, height: totalH + 24 }}>
                <svg
                  className="absolute inset-0 pointer-events-none z-0"
                  width={totalW}
                  height={totalH}
                >
                  {connectors}
                </svg>

                {layout.map((ln) => {
                  const isActive = activeId === ln.snap.id
                  const onActive = activePath.has(ln.snap.id)
                  const delay = revealDelay(ln.row, totalRows)

                  return (
                    <button
                      key={ln.snap.id}
                      type="button"
                      className={cn(
                        "absolute z-10 flex flex-col justify-center gap-0.5 rounded-md border px-2.5 transition-colors text-left cursor-pointer history-node-reveal",
                        isActive
                          ? "border-primary/60 bg-card text-foreground shadow-sm ring-1 ring-primary/35"
                          : onActive
                            ? "border-border bg-card text-foreground shadow-sm hover:bg-muted"
                            : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted",
                      )}
                      style={{
                        left: nodeX(ln.col),
                        top: nodeY(ln.row),
                        width: CARD_W,
                        height: CARD_H,
                        animationDelay: `${delay}ms`,
                        animationDuration: `${REVEAL_ITEM_MS}ms`,
                      }}
                      onClick={() => onSelect(ln.snap.id)}
                    >
                      {ln.snap.branch_name && (
                        <span className="self-start px-1 py-px rounded bg-primary/15 text-primary text-[8px] font-medium truncate max-w-full leading-tight">
                          {ln.snap.branch_name}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[10px] leading-tight">
                        <span className="font-mono font-medium">
                          {ln.snap.commit_sha.slice(0, 7)}
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0",
                            isActive ? "text-primary/80" : "text-muted-foreground/75",
                          )}
                        >
                          {relativeTime(ln.snap.commit_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] leading-tight">
                        <DeltaBadges snap={ln.snap} />
                      </div>
                      <p
                        className={cn(
                          "text-[10px] truncate leading-tight",
                          isActive || onActive ? "text-foreground/70" : "text-muted-foreground/60",
                        )}
                      >
                        {ln.snap.commit_message}
                      </p>
                    </button>
                  )
                })}

                {layout.map((ln) => {
                  if (!ln.snap.branch_name || !ln.snap.parent_snapshot_id) return null
                  const mr = branchMR.get(ln.snap.branch_name)
                  if (!mr) return null
                  const parentLn = nodeMap.get(ln.snap.parent_snapshot_id)
                  if (!parentLn || parentLn.col === ln.col) return null

                  const pCx = cardCenterX(parentLn.col)
                  const pBottom = cardBottom(parentLn.row)
                  const cCx = cardCenterX(ln.col)
                  const cTop = cardTop(ln.row)
                  const midX = (pCx + cCx) / 2
                  const midY = pBottom + (cTop - pBottom) / 2

                  return (
                    <button
                      key={`mr-${mr.id}`}
                      type="button"
                      className={cn(
                        "absolute z-20 px-1.5 py-0.5 rounded text-[7px] font-semibold uppercase cursor-pointer -translate-x-1/2 -translate-y-1/2 history-node-reveal",
                        mr.risk_level === "critical" ? "bg-red-950 text-red-400 border" :
                        mr.risk_level === "high" ? "bg-orange-950 text-orange-400 border" :
                        mr.risk_level === "medium" ? "bg-amber-950 text-amber-400 border" :
                        "bg-emerald-950 text-emerald-400 border",
                        activeMRId === mr.id
                          ? mr.risk_level === "critical" ? "border-red-500/60 ring-1 ring-red-500/35 shadow-sm" :
                            mr.risk_level === "high" ? "border-orange-500/60 ring-1 ring-orange-500/35 shadow-sm" :
                            mr.risk_level === "medium" ? "border-amber-500/60 ring-1 ring-amber-500/35 shadow-sm" :
                            "border-emerald-500/60 ring-1 ring-emerald-500/35 shadow-sm"
                          : "border-border/40 hover:border-border",
                      )}
                      style={{
                        left: midX,
                        top: midY,
                        animationDelay: `${revealDelay(ln.row, totalRows)}ms`,
                        animationDuration: `${REVEAL_ITEM_MS}ms`,
                      }}
                      onClick={() => onMRClick?.(mr.id)}
                    >
                      {mr.risk_level}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
