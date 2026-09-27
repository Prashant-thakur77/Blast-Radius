"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useChatStore, getActiveHighlight, type Message } from "@/store/chat-store"
import { useGraphStore } from "@/store/graph-store"
import { parseContentBlocks } from "@/lib/parse-flow-blocks"
import { streamChat } from "@/lib/chat-stream"
import { cn } from "@/lib/utils"
import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"

const REVEAL_STAGGER_MS = 80

interface ChatPanelProps {
  repoId: string
  onExitImpact?: () => void
}

function createId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ChatPanel({ repoId, onExitImpact }: ChatPanelProps) {
  const chat = useChatStore((s) => s.chats[repoId])
  const addMessage = useChatStore((s) => s.addMessage)
  const appendDelta = useChatStore((s) => s.appendDelta)
  const addReasoningStep = useChatStore((s) => s.addReasoningStep)
  const updateReasoningStep = useChatStore((s) => s.updateReasoningStep)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const setActiveFlow = useChatStore((s) => s.setActiveFlow)

  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const [welcomeLoaded, setWelcomeLoaded] = useState(false)
  const [animate, setAnimate] = useState(true)
  const [inputValue, setInputValue] = useState("")

  useEffect(() => {
    if (chat || welcomeLoaded) return
    setWelcomeLoaded(true)
    fetch(`/api/repos`)
      .then((r) => (r.ok ? r.json() : []))
      .then((repos: { id: string; welcome_message?: string | null }[]) => {
        const repo = repos.find((r) => r.id === repoId)
        if (repo?.welcome_message) {
          const blocks = parseContentBlocks(repo.welcome_message)
          const welcomeMsg: Message = {
            id: createId(),
            role: "assistant",
            blocks,
            rawContent: repo.welcome_message,
            reasoningSteps: [],
            timestamp: Date.now(),
          }
          addMessage(repoId, welcomeMsg)
          setAnimate(true)
          setTimeout(() => setAnimate(false), 1000)
        }
      })
      .catch(() => {})
  }, [repoId, chat, welcomeLoaded, addMessage])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const lastMsg = chat?.messages[chat.messages.length - 1]
  const lastMsgContent = lastMsg?.rawContent
  useEffect(() => {
    if (!isNearBottomRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat?.messages.length, lastMsgContent, chat?.isStreaming])

  const lastAssistantActions = useMemo(() => {
    if (!chat?.messages.length) return []
    const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant")
    if (!lastAssistant) return []
    const actionBlock = lastAssistant.blocks.find((b) => b.type === "actions")
    return actionBlock?.type === "actions" ? actionBlock.actions : []
  }, [chat?.messages])

  const isStreaming = chat?.isStreaming ?? false
  const activeFlowId = chat?.activeFlowId ?? null

  useEffect(() => {
    if (isStreaming) return
    const currentChat = useChatStore.getState().getChat(repoId)
    const { nodeIds, edgeKeys } = getActiveHighlight(currentChat)
    if (nodeIds.size > 0) {
      useGraphStore.getState().setHighlight(repoId, { source: "chat", nodeIds, edgeKeys })
      useGraphStore.getState().selectNode(repoId, null)
    } else {
      const currentHighlight = useGraphStore.getState().repos[repoId]?.highlight
      if (currentHighlight?.source === "chat") {
        useGraphStore.getState().setHighlight(repoId, null)
      }
    }
  }, [repoId, isStreaming, activeFlowId])

  const handleSend = useCallback(async (text: string) => {
    setAnimate(false)
    useGraphStore.getState().setHighlight(repoId, null)
    useGraphStore.getState().selectNode(repoId, null)
    onExitImpact?.()

    const userMsg: Message = {
      id: createId(),
      role: "user",
      blocks: [{ type: "text", text }],
      rawContent: text,
      reasoningSteps: [],
      timestamp: Date.now(),
    }
    addMessage(repoId, userMsg)

    const assistantMsgId = createId()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      blocks: [],
      rawContent: "",
      reasoningSteps: [],
      timestamp: Date.now(),
    }
    addMessage(repoId, assistantMsg)
    setStreaming(repoId, true)

    const MAX_HISTORY = 10
    const allMessages = (chat?.messages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.rawContent }))
    const history = allMessages.slice(-MAX_HISTORY)

    let reasoningStepId: string | null = null
    let reasoningText = ""
    let stepCounter = 0
    const toolIdMap: Record<string, string> = {}

    await streamChat(repoId, text, history, {
      onReasoning: (delta) => {
        reasoningText += delta
        if (!reasoningStepId) {
          stepCounter++
          reasoningStepId = `r-${assistantMsgId}-${stepCounter}`
          const headerMatch = reasoningText.match(/\*\*(.+?)\*\*/)
          addReasoningStep(repoId, assistantMsgId, {
            id: reasoningStepId,
            type: "thinking",
            title: headerMatch?.[1] ?? "Thinking...",
            content: reasoningText,
            status: "running",
          })
        } else {
          const headerMatch = reasoningText.match(/\*\*(.+?)\*\*/)
          updateReasoningStep(repoId, assistantMsgId, reasoningStepId, {
            title: headerMatch?.[1] ?? "Thinking...",
            content: reasoningText,
          })
        }
      },
      onToolStart: (id, name, args) => {
        if (reasoningStepId) {
          updateReasoningStep(repoId, assistantMsgId, reasoningStepId, { status: "success" })
          reasoningStepId = null
          reasoningText = ""
        }
        stepCounter++
        const stepId = `${id}-${assistantMsgId}-${stepCounter}`
        const queries = (args as { queries?: string[] }).queries ?? []
        const seedCount = ((args as { seed_ids?: string[] }).seed_ids ?? []).length
        const mode = (args as { mode?: string }).mode ?? "connect"
        const title = name === "vector_search"
          ? `Searching ${queries.length} keyword${queries.length > 1 ? "s" : ""}`
          : `${mode === "connect" ? "Connecting" : "Expanding"} ${seedCount} node${seedCount > 1 ? "s" : ""}`
        toolIdMap[id] = stepId
        let content = name === "vector_search"
          ? queries.map(q => `- ${q}`).join("\n")
          : ""
        addReasoningStep(repoId, assistantMsgId, {
          id: stepId,
          type: "tool",
          title,
          content,
          toolType: name as "vector_search" | "traverse",
          status: "running",
        })
      },
      onToolDone: (id, data) => {
        const sid = toolIdMap[id] ?? id
        const count = (data.count as number) ?? 0
        const currentStep = chat?.messages.find(m => m.id === assistantMsgId)
          ?.reasoningSteps.find(s => s.id === sid)
        const existingContent = currentStep?.content ?? ""

        let resultContent = existingContent
        const summary = data.summary as { name: string; kind: string; sim: number }[] | undefined
        const chains = data.chains as string[] | undefined

        if (summary?.length) {
          const lines = summary.map(s => `${s.name}  ${s.kind}  ${(s.sim * 100).toFixed(0)}%`)
          resultContent += (existingContent ? "\n" : "") + lines.join("\n")
        }
        if (chains?.length) {
          resultContent += (existingContent ? "\n" : "") + chains.join("\n")
        }

        updateReasoningStep(repoId, assistantMsgId, sid, {
          status: "success",
          resultCount: count,
          content: resultContent,
        })
      },
      onTextDelta: (delta) => {
        if (reasoningStepId) {
          updateReasoningStep(repoId, assistantMsgId, reasoningStepId, { status: "success" })
          reasoningStepId = null
        }
        appendDelta(repoId, assistantMsgId, delta)
      },
      onReplaceText: (text) => {
        useChatStore.setState((s) => {
          const c = s.chats[repoId]
          if (!c) return s
          const messages = c.messages.map((m) => {
            if (m.id !== assistantMsgId) return m
            return { ...m, rawContent: text, blocks: parseContentBlocks(text) }
          })
          return { chats: { ...s.chats, [repoId]: { ...c, messages } } }
        })
      },
      onDone: () => {
        setStreaming(repoId, false)
      },
      onError: (error) => {
        appendDelta(repoId, assistantMsgId, `\n\nError: ${error}`)
        setStreaming(repoId, false)
      },
    }, useGraphStore.getState().repos[repoId]?.data?.snapshot_id)
  }, [repoId, chat?.messages, addMessage, appendDelta, addReasoningStep, updateReasoningStep, setStreaming])

  const handleFlowClick = (flowId: string) => {
    const current = useChatStore.getState().getChat(repoId).activeFlowId
    setActiveFlow(repoId, current === flowId ? null : flowId)
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5">
        <div className="space-y-2">
          {!chat || chat.messages.length === 0 ? (
            <div />
          ) : (
            chat.messages.map((msg, i) => (
              <div
                key={msg.id}
                className={cn(i === 0 && animate && "animate-fade-in")}
                style={i === 0 && animate ? { animationDelay: "0ms" } : undefined}
              >
                <ChatMessage
                  message={msg}
                  activeFlowId={chat.activeFlowId}
                  onFlowClick={handleFlowClick}
                  isStreaming={chat.isStreaming && msg.id === chat.messages[chat.messages.length - 1]?.id}
                />
              </div>
            ))
          )}
        </div>

        {!chat?.isStreaming && lastAssistantActions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {lastAssistantActions.map((action, i) => (
              <div
                key={action}
                className={cn(animate && "animate-fade-in")}
                style={animate ? { animationDelay: `${(i + 1) * REVEAL_STAGGER_MS}ms` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => { setInputValue(action) }}
                  className="cursor-pointer rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {action}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 pt-0">
        <ChatInput value={inputValue} onChange={setInputValue} onSend={handleSend} isLoading={chat?.isStreaming} />
      </div>
    </div>
  )
}
