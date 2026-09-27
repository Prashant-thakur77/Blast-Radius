"use client"

import { useState, useEffect, useRef } from "react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface Stage {
  at: number
  message: string
}

interface ProgressProfile {
  estimatedMs: number
  stages: Stage[]
}

const PROFILES: Record<string, ProgressProfile> = {
  "repo-add": {
    estimatedMs: 90000,
    stages: [
      { at: 0, message: "Cloning repository..." },
      { at: 15, message: "Parsing codebase..." },
      { at: 35, message: "Generating descriptions..." },
      { at: 55, message: "Computing embeddings..." },
      { at: 70, message: "Clustering subsystems..." },
      { at: 85, message: "Computing layout..." },
      { at: 95, message: "Finalizing..." },
    ],
  },
}

function getMessage(stages: Stage[], progress: number): string {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (progress >= stages[i].at) return stages[i].message
  }
  return stages[0]?.message ?? "Processing..."
}

interface ProgressIndicatorProps {
  profile: keyof typeof PROFILES | ProgressProfile
  isActive: boolean
  isComplete: boolean
  onComplete?: () => void
  completeMessage?: string
  extraTimeMs?: number
  startedAt?: number
  className?: string
}

interface StageTiming {
  start: number
  end: number
  jumpAt: number | null
}

function generateStageTiming(stages: Stage[], totalMs: number): StageTiming[] {
  const stageCount = stages.length
  const baseInterval = totalMs / stageCount

  const rawTimings: number[] = [0]
  let cumulative = 0

  for (let i = 1; i < stageCount; i++) {
    const variance = 0.5 + Math.random() * 1.0
    cumulative += baseInterval * variance
    rawTimings.push(cumulative)
  }

  const scale = (totalMs * 0.95) / cumulative
  const scaledTimings = rawTimings.map(t => t * scale)

  const timings: StageTiming[] = []
  for (let i = 0; i < stageCount; i++) {
    const start = scaledTimings[i]
    const end = scaledTimings[i + 1] ?? totalMs * 0.95
    const hasJump = Math.random() < 0.4
    const jumpAt = hasJump ? start + (end - start) * (0.3 + Math.random() * 0.4) : null
    timings.push({ start, end, jumpAt })
  }

  return timings
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function ProgressIndicator({
  profile,
  isActive,
  isComplete,
  onComplete,
  completeMessage = "Complete",
  extraTimeMs = 0,
  startedAt,
  className,
}: ProgressIndicatorProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const animationRef = useRef<number | null>(null)
  const stageTimingsRef = useRef<StageTiming[] | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const baseConfig = typeof profile === "string" ? PROFILES[profile] : profile
  const config = { ...baseConfig, estimatedMs: baseConfig.estimatedMs + extraTimeMs }

  useEffect(() => {
    if (!isActive || isComplete) {
      startTimeRef.current = null
      stageTimingsRef.current = null
      lastUpdateRef.current = 0
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    if (!startTimeRef.current) {
      startTimeRef.current = startedAt ?? Date.now()
      stageTimingsRef.current = generateStageTiming(config.stages, config.estimatedMs)
    }

    const animate = () => {
      const now = Date.now()
      const elapsed = now - (startTimeRef.current ?? now)
      const timings = stageTimingsRef.current ?? []

      let currentStage = 0
      for (let i = 0; i < timings.length; i++) {
        if (elapsed >= timings[i].start) currentStage = i
      }

      const timing = timings[currentStage]
      const currentAt = config.stages[currentStage]?.at ?? 0
      const nextAt = config.stages[currentStage + 1]?.at ?? 95

      let smoothProgress: number
      if (elapsed >= config.estimatedMs) {
        const overtimeMs = elapsed - config.estimatedMs
        smoothProgress = 95 + 4 * (1 - Math.exp(-overtimeMs / 15000))
      } else if (timing.jumpAt && elapsed >= timing.jumpAt) {
        smoothProgress = nextAt
      } else {
        const effectiveEnd = timing.jumpAt ?? timing.end
        const stageElapsed = elapsed - timing.start
        const stageDuration = effectiveEnd - timing.start
        const t = Math.min(stageElapsed / stageDuration, 1)
        const eased = easeInOutCubic(t)
        smoothProgress = currentAt + (nextAt - currentAt) * eased
      }

      if (now - lastUpdateRef.current >= 50) {
        lastUpdateRef.current = now
        setAnimatedProgress(Math.min(99, smoothProgress))
      }

      if (!isComplete) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isActive, isComplete, config.estimatedMs, config.stages, extraTimeMs])

  const progress = !isActive ? 0 : isComplete ? 100 : animatedProgress

  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const timer = setTimeout(onComplete, 500)
      return () => clearTimeout(timer)
    }
  }, [progress, onComplete])

  if (!isActive) return null

  const message = isComplete ? completeMessage : getMessage(config.stages, progress)

  return (
    <div className={cn("space-y-2", className)}>
      <Progress
        value={progress}
        className={cn(
          "h-2 transition-colors duration-300",
          isComplete && "[&>[data-slot=progress-indicator]]:bg-success-fg"
        )}
      />
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground transition-opacity duration-500",
          !isComplete && "animate-pulse"
        )}
      >
        <span>{message}</span>
      </div>
    </div>
  )
}

export { PROFILES, type ProgressProfile }
