import { create } from "zustand"
import type { GraphData, GraphHighlight } from "@/types/graph"

interface RepoGraph {
  data: GraphData | null
  highlight: GraphHighlight | null
  selectedNodeId: string | null
}

interface GraphState {
  repos: Record<string, RepoGraph>
  setData: (repoId: string, data: GraphData | null) => void
  setHighlight: (repoId: string, highlight: GraphHighlight | null) => void
  selectNode: (repoId: string, nodeId: string | null) => void
  reset: (repoId: string) => void
}

const emptyRepo: RepoGraph = { data: null, highlight: null, selectedNodeId: null }

function getRepo(state: GraphState, repoId: string): RepoGraph {
  return state.repos[repoId] ?? emptyRepo
}

export const useGraphStore = create<GraphState>((set, get) => ({
  repos: {},

  setData: (repoId, data) =>
    set((s) => ({
      repos: {
        ...s.repos,
        [repoId]: { ...getRepo(s, repoId), data },
      },
    })),

  setHighlight: (repoId, highlight) =>
    set((s) => ({
      repos: {
        ...s.repos,
        [repoId]: { ...getRepo(s, repoId), highlight },
      },
    })),

  selectNode: (repoId, nodeId) =>
    set((s) => ({
      repos: {
        ...s.repos,
        [repoId]: { ...getRepo(s, repoId), selectedNodeId: nodeId },
      },
    })),

  reset: (repoId) =>
    set((s) => ({
      repos: { ...s.repos, [repoId]: emptyRepo },
    })),
}))
