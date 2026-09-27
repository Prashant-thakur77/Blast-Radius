"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"

export default function SignInPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Sign in failed")
        setLoading(false)
        return
      }

      router.push(data.workspaceSlug ? `/${data.workspaceSlug}/dashboard` : "/new-workspace")
      router.refresh()
    } catch {
      toast.error("Network error")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[352px] space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <Logo width={80} height={80} className="h-20 w-20" />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold">Welcome to Pulse</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-xs font-medium text-muted-foreground">Username</label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11"
            disabled={loading || !username || !password}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-foreground font-medium">
            Sign up
          </Link>
        </p>

        <div className="flex justify-center">
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
