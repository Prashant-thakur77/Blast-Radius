"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProgressIndicator } from "@/components/ui/progress-indicator"
import { Logo } from "@/components/logo"
import { apiFetch, getApiKey } from "@/lib/api"

export default function NewRepoPage() {
  const [name, setName] = useState("pulse")
  const [url, setUrl] = useState("https://github.com/username/project.git")
  const [sourceRoot, setSourceRoot] = useState("pulse")
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [repoId, setRepoId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!getApiKey()) router.push("/setup")
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const cloneRes = await apiFetch("/api/repos", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), url: url.trim(), source_root: sourceRoot.trim() || undefined }),
      })

      if (!cloneRes.ok) {
        const data = await cloneRes.json()
        toast.error(data.detail || "Failed to clone repository")
        setLoading(false)
        return
      }

      const repo = await cloneRes.json()
      setRepoId(repo.id)

      const syncRes = await apiFetch(`/api/repos/${repo.id}/sync`, {
        method: "POST",
      })

      if (!syncRes.ok) {
        const data = await syncRes.json()
        toast.error(data.detail || "Failed to sync repository")
        setLoading(false)
        return
      }

      setComplete(true)
    } catch {
      toast.error("Network error — is the backend running?")
      setLoading(false)
    }
  }

  const handleComplete = () => {
    if (repoId) {
      window.location.href = `/${repoId}`
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <Logo width={80} height={80} className="h-20 w-20" />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Add a repository
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Turn a codespace into a semantic graph that reveals
              <br className="hidden sm:block" />
              how your code connects, clusters, and evolves.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="repo-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Repository name
              </label>
              <Input
                id="repo-name"
                type="text"
                placeholder="my-project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                autoFocus
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="repo-url"
                className="text-xs font-medium text-muted-foreground"
              >
                Git URL
              </label>
              <Input
                id="repo-url"
                type="url"
                placeholder="https://github.com/username/project.git"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="source-root"
                className="text-xs font-medium text-muted-foreground"
              >
                Source root (optional)
              </label>
              <Input
                id="source-root"
                type="text"
                placeholder="e.g. src or packages/app"
                value={sourceRoot}
                onChange={(e) => setSourceRoot(e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>
          </div>

          {loading ? (
            <ProgressIndicator
              profile="repo-add"
              isActive={loading}
              isComplete={complete}
              onComplete={handleComplete}
              completeMessage="Repository ready"
              className="w-full"
            />
          ) : (
            <Button
              type="submit"
              className="w-full h-11"
              disabled={!name.trim() || !url.trim()}
            >
              Continue
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
