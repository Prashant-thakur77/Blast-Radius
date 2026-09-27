"use client"

import Link from "next/link"
import {
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Bell,
  BarChart3,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Threads } from "@/components/ui/threads"

const features = [
  {
    icon: FolderKanban,
    title: "Projects",
    description: "Organize work into focused projects with clear ownership.",
  },
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Track what needs to get done, by whom, and by when.",
  },
  {
    icon: MessageSquare,
    title: "Comments",
    description: "Discuss decisions in context, right where the work happens.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Stay informed without the noise. See what matters.",
  },
  {
    icon: BarChart3,
    title: "Dashboard",
    description: "A clear overview of progress across your workspace.",
  },
  {
    icon: Search,
    title: "Search",
    description: "Find anything instantly across projects and tasks.",
  },
]

export default function LandingPage() {
  return (
    <div className="relative flex flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-6 py-24 md:py-32 lg:py-40 overflow-hidden">
        {/* Threads background */}
        <div className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-50">
          <Threads
            color={[0.45, 0.5, 0.9]}
            amplitude={1.2}
            distance={0.15}
            enableMouseInteraction
          />
        </div>

        <h1 className="relative max-w-2xl text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1]">
          Your team&apos;s workspace, simplified.
        </h1>
        <p className="relative mt-6 max-w-lg text-base md:text-lg text-foreground/70 leading-relaxed">
          A lightweight workspace for managing projects, tasks, and team
          communication. Nothing more, nothing less.
        </p>
        <div className="relative mt-10 flex items-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="flex flex-col items-center px-6 py-20 md:py-24">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Everything you need
        </h2>
        <p className="mt-3 max-w-md text-sm md:text-base text-muted-foreground text-center">
          Simple tools that work together so your team can focus on what matters.
        </p>
        <div className="mt-12 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border p-6 transition-colors hover:bg-accent/50"
            >
              <feature.icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-medium">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy */}
      <section className="flex flex-col items-center text-center px-6 py-20 md:py-24">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Built with intention
        </h2>
        <p className="mt-4 max-w-lg text-sm md:text-base text-muted-foreground leading-relaxed">
          Every feature is introduced incrementally. Every module has clear
          boundaries. The architecture is designed to be understood, not just
          to function.
        </p>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center text-center px-6 pt-8 pb-24 md:pb-32">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Ready to get started?
        </h2>
        <div className="mt-6">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
