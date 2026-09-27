import { create } from "zustand"
import { parseContentBlocks, type ContentBlock, type Flow } from "@/lib/parse-flow-blocks"

export interface SearchNeighbor {
  id: string
  qualname: string
  symbol_name: string
  kind: string
  edge_type: string
  direction: "outgoing" | "incoming"
}

export interface SearchResultItem {
  id: string
  qualname: string
  symbol_name: string
  file_path: string
  kind: string
  llm_description: string | null
  similarity: number
  neighbors: SearchNeighbor[]
}

export interface ReasoningStep {
  id: string
  type: "thinking" | "tool"
  title: string
  content?: string
  toolType?: "vector_search" | "traverse"
  status: "running" | "success" | "error"
  results?: SearchResultItem[]
  resultCount?: number
}

export interface Message {
  id: string
  role: "user" | "assistant"
  blocks: ContentBlock[]
  rawContent: string
  reasoningSteps: ReasoningStep[]
  timestamp: number
}

export interface Chat {
  repoId: string
  messages: Message[]
  isStreaming: boolean
  activeFlowId: string | null
}

interface ChatState {
  chats: Record<string, Chat>
  getChat: (repoId: string) => Chat
  addMessage: (repoId: string, message: Message) => void
  appendDelta: (repoId: string, messageId: string, delta: string) => void
  addReasoningStep: (repoId: string, messageId: string, step: ReasoningStep) => void
  updateReasoningStep: (repoId: string, messageId: string, stepId: string, updates: Partial<ReasoningStep>) => void
  setStreaming: (repoId: string, streaming: boolean) => void
  setActiveFlow: (repoId: string, flowId: string | null) => void
  clearChat: (repoId: string) => void
}

function createChat(repoId: string): Chat {
  return { repoId, messages: [], isStreaming: false, activeFlowId: null }
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: {},

  getChat: (repoId) => {
    const existing = get().chats[repoId]
    if (existing) return existing
    const chat = createChat(repoId)
    set((s) => ({ chats: { ...s.chats, [repoId]: chat } }))
    return chat
  },

  addMessage: (repoId, message) =>
    set((s) => {
      const chat = s.chats[repoId] ?? createChat(repoId)
      return { chats: { ...s.chats, [repoId]: { ...chat, messages: [...chat.messages, message] } } }
    }),

  appendDelta: (repoId, messageId, delta) =>
    set((s) => {
      const chat = s.chats[repoId]
      if (!chat) return s
      const messages = chat.messages.map((m) => {
        if (m.id !== messageId) return m
        const rawContent = m.rawContent + delta
        return { ...m, rawContent, blocks: parseContentBlocks(rawContent) }
      })
      return { chats: { ...s.chats, [repoId]: { ...chat, messages } } }
    }),

  addReasoningStep: (repoId, messageId, step) =>
    set((s) => {
      const chat = s.chats[repoId]
      if (!chat) return s
      const messages = chat.messages.map((m) => {
        if (m.id !== messageId) return m
        return { ...m, reasoningSteps: [...m.reasoningSteps, step] }
      })
      return { chats: { ...s.chats, [repoId]: { ...chat, messages } } }
    }),

  updateReasoningStep: (repoId, messageId, stepId, updates) =>
    set((s) => {
      const chat = s.chats[repoId]
      if (!chat) return s
      const messages = chat.messages.map((m) => {
        if (m.id !== messageId) return m
        const reasoningSteps = m.reasoningSteps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step,
        )
        return { ...m, reasoningSteps }
      })
      return { chats: { ...s.chats, [repoId]: { ...chat, messages } } }
    }),

  setStreaming: (repoId, streaming) =>
    set((s) => {
      const chat = s.chats[repoId] ?? createChat(repoId)
      return { chats: { ...s.chats, [repoId]: { ...chat, isStreaming: streaming } } }
    }),

  setActiveFlow: (repoId, flowId) =>
    set((s) => {
      const chat = s.chats[repoId]
      if (!chat) return s
      return { chats: { ...s.chats, [repoId]: { ...chat, activeFlowId: flowId } } }
    }),

  clearChat: (repoId) =>
    set((s) => ({ chats: { ...s.chats, [repoId]: createChat(repoId) } })),
}))

export function getActiveHighlight(chat: Chat): { nodeIds: Set<string>; edgeKeys: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeKeys = new Set<string>()

  const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant")
  if (!lastAssistant) return { nodeIds, edgeKeys }

  const flows = lastAssistant.blocks
    .filter((b): b is { type: "flow"; flow: Flow } => b.type === "flow")
    .map((b) => b.flow)

  const target = chat.activeFlowId
    ? flows.find((f) => f.id === chat.activeFlowId)
    : null

  const activeFlows = target ? [target] : flows

  for (const flow of activeFlows) {
    for (const id of flow.node_ids) nodeIds.add(id)
    for (const ek of flow.edge_keys ?? []) {
      edgeKeys.add(`${ek.source}::${ek.target}::${ek.edge_type}`)
    }
  }

  return { nodeIds, edgeKeys }
}

export type { ContentBlock, Flow }
