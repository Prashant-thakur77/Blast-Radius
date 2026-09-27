import { LucideIcon, LayoutDashboard, Inbox, FolderKanban, Settings } from "lucide-react"

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  isPanel?: boolean
}

export function getNavItems(workspaceSlug: string): NavItem[] {
  const base = `/${workspaceSlug}`
  return [
    { href: `${base}/dashboard`, icon: LayoutDashboard, label: "Dashboard" },
    { href: `${base}/projects`, icon: FolderKanban, label: "Projects" },
    { href: `${base}/inbox`, icon: Inbox, label: "Inbox", isPanel: true },
    { href: `${base}/settings`, icon: Settings, label: "Workspace settings" },
  ]
}
