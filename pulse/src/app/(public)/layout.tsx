"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
        <header className="flex items-center justify-between w-full max-w-sm h-11 rounded-full border bg-background/60 backdrop-blur-xl px-5">
          <Link href="/" className="flex items-center gap-1.5">
            <Logo
              width={28}
              height={28}
              className="w-5 h-5"
            />
            <span className="text-sm font-semibold">Pulse</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button asChild size="xs" variant="ghost" className="rounded-full px-3">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
      </div>
      <main className="flex-1 pt-14">{children}</main>
    </div>
  )
}
