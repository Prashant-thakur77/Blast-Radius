"use client"

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const MAX_HEIGHT = 120

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  isLoading?: boolean
  placeholder?: string
}

export function ChatInput({ value, onChange, onSend, isLoading = false, placeholder = "Ask about the codebase..." }: ChatInputProps) {
  const [isMultiline, setIsMultiline] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "0"
    const scrollHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT)
    textarea.style.height = `${scrollHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? "auto" : "hidden"
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
    setIsMultiline(textarea.scrollHeight > lineHeight * 1.5)
  }, [])

  useEffect(() => { resize() }, [value, resize])

  const handleSend = useCallback(() => {
    const message = value.trim()
    if (!message || isLoading) return
    onChange("")
    setIsMultiline(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    onSend(message)
  }, [value, isLoading, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = value.trim() && !isLoading

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 border bg-background p-2 transition-colors",
        isMultiline ? "rounded-2xl" : "rounded-full",
        "focus-within:border-foreground/40",
      )}
    >
      <div className="flex items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); resize() }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none border-none bg-transparent px-2 py-1 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: 20, maxHeight: MAX_HEIGHT }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
            canSend
              ? "cursor-pointer bg-foreground text-background hover:bg-foreground/80"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
    </div>
  )
}
