import { cn } from "@/lib/utils"

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 py-6 md:px-4 md:py-8 lg:px-6 lg:py-10 pb-24 max-w-2xl", className)}>
      {children}
    </div>
  )
}
