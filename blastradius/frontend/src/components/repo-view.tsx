"use client"

import { useState, useEffect, useCallback } from "react"
import { MobileViewSelector, type MobileView } from "@/components/layout/mobile-view-selector"
import { ExplorerHeader, type ExplorerTab } from "@/components/layout/explorer-header"
import { HistoryPanel } from "@/components/explorer/history-panel"
import { FileTree } from "@/components/explorer/file-tree"
import { SnapshotBar } from "@/components/graph/snapshot-bar"
import { GraphCanvas } from "@/components/graph/graph-canvas"
import { ChatPanel } from "@/components/chat/chat-panel"
import { useGraphStore } from "@/store/graph-store"
import { highlightNode, highlightFile } from "@/lib/graph-utils"
import { useMRData } from "@/lib/use-mr-data"

interface RepoViewProps {
  repoId: string
  initialSnapshotId?: string
  mrId?: string
}

export function RepoView({ repoId, initialSnapshotId, mrId: initialMrId }: RepoViewProps) {
  const [mrId, setMrId] = useState<string | null>(initialMrId ?? null)
  const mrData = useMRData(repoId, mrId)
  const [snapshotId, setSnapshotId] = useState<string | null>(initialSnapshotId ?? null)
  const [mobileView, setMobileView] = useState<MobileView>("graph")
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>("files")

  useEffect(() => {
    fetch(`/api/repos/${repoId}/snapshots`)
      .then((r) => (r.ok ? r.json() : []))
      .then((snapshots: { id: string; branch_name?: string | null }[]) => {
        if (!snapshots.length) return
        if (initialSnapshotId && snapshots.some((s) => s.id === initialSnapshotId)) return
        const mainSnapshots = snapshots.filter((s) => s.branch_name === "main")
        const defaultSnap = mainSnapshots.length > 0
          ? mainSnapshots[mainSnapshots.length - 1]
          : snapshots[snapshots.length - 1]
        setSnapshotId(defaultSnap.id)
      })
      .catch(() => {})
  }, [repoId, initialSnapshotId])

  const handleSnapshotSelect = useCallback((id: string) => {
    setSnapshotId(id)
    setMrId(null)
    useGraphStore.getState().selectNode(repoId, null)
    useGraphStore.getState().setHighlight(repoId, null)
    window.history.replaceState(null, "", `/${repoId}?s=${id}`)
  }, [repoId])

  const handleSelectUnit = useCallback((unitId: string) => {
    const data = useGraphStore.getState().repos[repoId]?.data
    if (!data) return
    useGraphStore.getState().selectNode(repoId, unitId)
    useGraphStore.getState().setHighlight(repoId, highlightNode(data, unitId, 1))
  }, [repoId])

  const handleSelectFile = useCallback((filePath: string | null) => {
    if (!filePath) {
      useGraphStore.getState().selectNode(repoId, null)
      useGraphStore.getState().setHighlight(repoId, null)
      return
    }
    const data = useGraphStore.getState().repos[repoId]?.data
    if (!data) return
    useGraphStore.getState().selectNode(repoId, null)
    useGraphStore.getState().setHighlight(repoId, highlightFile(data, filePath))
  }, [repoId])

  const handleMRClose = useCallback(() => {
    setMrId(null)
    window.history.replaceState(null, "", `/${repoId}${snapshotId ? `?s=${snapshotId}` : ""}`)
  }, [repoId, snapshotId])

  return (
    <div className="h-[calc(100vh-2.75rem)] flex flex-col">
      <MobileViewSelector view={mobileView} onViewChange={setMobileView} />

      <div className="flex-1 flex flex-col min-[1430px]:flex-row overflow-hidden">
        <div
          className={`${mobileView === "explorer" ? "flex" : "hidden"} min-[1430px]:flex w-full min-[1430px]:w-[450px] shrink-0 flex-col flex-1 min-[1430px]:flex-initial overflow-hidden border-r`}
        >
          <ExplorerHeader tab={explorerTab} onTabChange={setExplorerTab} />
          <div className="flex-1 overflow-auto">
            {explorerTab === "history" ? (
              <HistoryPanel
                repoId={repoId}
                activeSnapshotId={mrId ? null : snapshotId}
                activeMRId={mrId}
                onSelect={handleSnapshotSelect}
                onMRClick={(id) => {
                  setMrId(id)
                  window.history.replaceState(null, "", `/${repoId}?mr=${id}`)
                }}
              />
            ) : (
              <FileTree repoId={repoId} snapshotId={snapshotId} onSelectUnit={mrData ? undefined : handleSelectUnit} onSelectFile={mrData ? undefined : handleSelectFile} />
            )}
          </div>
        </div>

        <div
          className={`${mobileView === "graph" ? "flex" : "hidden"} min-[1430px]:flex flex-1 min-w-0 flex-col overflow-hidden`}
        >
          <SnapshotBar repoId={repoId} snapshotId={snapshotId} mrData={mrData} onMRClose={handleMRClose} />
          <GraphCanvas repoId={repoId} snapshotId={snapshotId} mrData={mrData} />
        </div>

        <div
          className={`${mobileView === "chat" ? "flex" : "hidden"} min-[1430px]:flex w-full max-w-[450px] mx-auto min-[1430px]:mx-0 min-[1430px]:max-w-none min-[1430px]:w-[450px] shrink-0 flex-col flex-1 min-[1430px]:flex-initial overflow-hidden min-[1430px]:border-l`}
        >
          <ChatPanel repoId={repoId} onExitImpact={handleMRClose} />
        </div>
      </div>
    </div>
  )
}
