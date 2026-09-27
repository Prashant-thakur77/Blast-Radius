"use client"

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronDown, Search, Waypoints, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReasoningStep } from "@/store/chat-store"

interface ReasoningStepsProps {
  steps: ReasoningStep[]
}

function ThinkingStep({ step, expanded, onToggle, isNew }: {
  step: ReasoningStep
  expanded: boolean
  onToggle: () => void
  isNew: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const hasContent = !!step.content

  useEffect(() => {
    if (isNew && ref.current) {
      ref.current.style.opacity = "0"
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (ref.current) {
            ref.current.style.transition = "opacity 0.4s ease-out"
            ref.current.style.opacity = "1"
          }
        })
      })
    }
  }, [isNew])

  return (
    <div ref={ref} className="relative" style={{ opacity: isNew ? 0 : 1 }}>
      <div className="flex items-center gap-2 h-8">
        <div className="size-4 flex items-center justify-center shrink-0 relative z-10">
          <div className="size-1.5 rounded-full bg-muted-foreground" />
        </div>
        {hasContent ? (
          <button onClick={onToggle} className="flex-1 flex items-center justify-between text-left cursor-pointer min-w-0">
            <span className="text-sm text-muted-foreground truncate">{step.title}</span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
          </button>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground truncate">{step.title}</span>
        )}
      </div>
      {expanded && hasContent && (
        <div className="mt-1 ml-6 max-h-48 overflow-y-auto mb-1">
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/70 break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.content!}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolStep({ step, expanded, onToggle, isNew }: {
  step: ReasoningStep
  expanded: boolean
  onToggle: () => void
  isNew: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isRunning = step.status === "running"
  const Icon = step.toolType === "vector_search" ? Search : Waypoints
  const hasContent = !!step.content

  useEffect(() => {
    if (isNew && ref.current) {
      ref.current.style.opacity = "0"
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (ref.current) {
            ref.current.style.transition = "opacity 0.4s ease-out"
            ref.current.style.opacity = "1"
          }
        })
      })
    }
  }, [isNew])

  return (
    <div ref={ref} className="relative" style={{ opacity: isNew ? 0 : 1 }}>
      <div className="flex items-center gap-2 h-8">
        <div className="size-4 flex items-center justify-center shrink-0 relative z-10">
          <div className="absolute size-3 bg-background" />
          {isRunning ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground relative" />
          ) : (
            <Icon className="size-3.5 text-muted-foreground relative" />
          )}
        </div>
        <button
          onClick={hasContent ? onToggle : undefined}
          className={cn("flex-1 flex items-center gap-2 text-left min-w-0", hasContent && "cursor-pointer")}
        >
          <span className="flex-1 text-sm truncate">{step.title}</span>
          <span className="text-xs text-muted-foreground/50 shrink-0 w-16 text-right">
            {step.resultCount !== undefined && step.status === "success" ? `${step.resultCount} results` : ""}
          </span>
          <ChevronDown className={cn(
            "size-4 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-180",
            !hasContent && "invisible",
          )} />
        </button>
      </div>
      {expanded && hasContent && (
        <div className="mt-1 ml-6 max-h-48 overflow-y-auto mb-1 space-y-0.5">
          {step.content!.split("\n").filter(Boolean).map((line, i) => (
            <div key={i} className="text-[11px] text-muted-foreground/70 font-mono truncate">{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReasoningSteps({ steps }: ReasoningStepsProps) {
  const [showAll, setShowAll] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const seenRef = useRef<Set<string>>(new Set())
  const [newSteps, setNewSteps] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const [lineHeight, setLineHeight] = useState(0)

  useEffect(() => {
    const newIds = new Set<string>()
    steps.forEach((s) => {
      if (!seenRef.current.has(s.id)) {
        newIds.add(s.id)
        seenRef.current.add(s.id)
      }
    })
    if (newIds.size > 0) {
      requestAnimationFrame(() => setNewSteps(newIds))
      const timer = setTimeout(() => setNewSteps(new Set()), 500)
      return () => clearTimeout(timer)
    }
  }, [steps])

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || steps.length < 2) {
        setLineHeight(0)
        return
      }
      const children = containerRef.current.children
      if (children.length < 2) return
      const first = children[0] as HTMLElement
      const last = children[children.length - 1] as HTMLElement
      setLineHeight(last.offsetTop - first.offsetTop)
    }
    update()
    const timer = setTimeout(update, 50)
    return () => clearTimeout(timer)
  }, [steps, expandedSteps, showAll])

  if (steps.length === 0) return null

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mb-2">
      <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2">
        {showAll ? <ChevronDown className="size-4" /> : <ChevronDown className="size-4 -rotate-90" />}
        {showAll ? "Hide steps" : "Show steps"}
      </button>
      {showAll && (
        <div className="relative">
          {steps.length > 1 && lineHeight > 0 && (
            <div
              className="absolute left-2 w-px bg-muted-foreground/30 -translate-x-1/2"
              style={{ top: 16, height: lineHeight }}
            />
          )}
          <div ref={containerRef}>
            {steps.map((step) =>
              step.type === "thinking" ? (
                <ThinkingStep
                  key={step.id}
                  step={step}
                  expanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStep(step.id)}
                  isNew={newSteps.has(step.id)}
                />
              ) : (
                <ToolStep
                  key={step.id}
                  step={step}
                  expanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStep(step.id)}
                  isNew={newSteps.has(step.id)}
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
