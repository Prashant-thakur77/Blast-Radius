import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { MainContent } from "./main-content"
import { InboxProvider } from "@/features/notifications/components/inbox-context"
import { InboxPanel } from "@/features/notifications/components/inbox-panel"
import { SearchProvider } from "@/features/search/components/search-context"
import { CommandSearch } from "@/features/search/components/command-search"

interface AppShellProps {
  user: { id: string; username: string; displayName?: string | null }
  workspace: { id: string; name: string; slug: string }
  workspaces: { id: string; name: string; slug: string }[]
  children: React.ReactNode
}

export function AppShell({ user, workspace, workspaces, children }: AppShellProps) {
  return (
    <InboxProvider workspaceId={workspace.id}>
      <SearchProvider>
        <AppHeader user={user} workspace={workspace} workspaces={workspaces} />
        <AppSidebar workspaceSlug={workspace.slug} />
        <InboxPanel workspaceId={workspace.id} workspaceSlug={workspace.slug} />
        <CommandSearch workspaceId={workspace.id} workspaceSlug={workspace.slug} />
        <MainContent>{children}</MainContent>
      </SearchProvider>
    </InboxProvider>
  )
}
