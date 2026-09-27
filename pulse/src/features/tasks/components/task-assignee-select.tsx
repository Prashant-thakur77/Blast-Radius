"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkspaceMemberInfo } from "@/features/workspace/types"

interface TaskAssigneeSelectProps {
  members: WorkspaceMemberInfo[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function TaskAssigneeSelect({
  members,
  value,
  onValueChange,
  disabled,
}: TaskAssigneeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__unassigned">Unassigned</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            {m.displayName || m.username}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
