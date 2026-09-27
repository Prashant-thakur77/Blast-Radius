"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"

export default function OnboardingPage() {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to create workspace")
        setLoading(false)
        return
      }

      router.push(`/${data.workspace.slug}/dashboard`)
      router.refresh()
    } catch {
      toast.error("Network error")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <Logo width={80} height={80} className="h-20 w-20" />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create your workspace
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Workspaces are shared environments where your team
              <br className="hidden sm:block" />
              can organize projects and collaborate together.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="workspace-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Workspace name
              </label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                autoFocus
                autoComplete="off"
                className="h-11"
              />
            </div>

            {slug && (
              <p className="text-xs text-muted-foreground">
                Your workspace URL will be{" "}
                <span className="font-mono text-foreground/70">
                  pulse.app/{slug}
                </span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11"
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating workspace..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  )
}
