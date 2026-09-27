import Link from "next/link"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <Logo width={64} height={64} className="h-16 w-16" />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-sm font-medium text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you are looking for does not exist.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  )
}
