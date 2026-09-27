"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"

export default function SetupPage() {
  const [key, setKey] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/verify", {
        headers: { "X-API-Key": key.trim() },
      })

      if (res.ok) {
        localStorage.setItem("blastradius-api-key", key.trim())
        router.push("/new")
        return
      } else if (res.status === 403) {
        setError("Invalid API key")
      } else {
        setError("Could not verify key")
      }
    } catch {
      setError("Network error — is the backend running?")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <Logo width={80} height={80} className="h-20 w-20" />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Enter API key
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              An API key is required to access protected operations.
              <br className="hidden sm:block" />
              Contact the project owner or check the README.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="api-key"
              className="text-xs font-medium text-muted-foreground"
            >
              API key
            </label>
            <Input
              id="api-key"
              type="password"
              placeholder="blastradius-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              disabled={loading}
              autoFocus
              className="h-11"
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11"
            disabled={!key.trim() || loading}
          >
            {loading ? "Verifying..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  )
}
