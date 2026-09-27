import { cn } from "@/lib/utils"

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        role === "owner"
          ? "bg-brand/10 text-brand dark:bg-brand/20"
          : "bg-muted text-muted-foreground"
      )}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}
