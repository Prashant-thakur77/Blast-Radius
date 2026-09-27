import {
  FolderKanban,
  Rocket,
  Target,
  Palette,
  Globe,
  Code,
  BarChart3,
  Megaphone,
  Users,
  BookOpen,
  Wrench,
  FlaskConical,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ProjectIcon } from "./types"

export const iconConfig: Record<ProjectIcon, { icon: LucideIcon; label: string }> = {
  "folder-kanban": { icon: FolderKanban, label: "Project" },
  "rocket": { icon: Rocket, label: "Launch" },
  "target": { icon: Target, label: "Goals" },
  "palette": { icon: Palette, label: "Design" },
  "globe": { icon: Globe, label: "Website" },
  "code": { icon: Code, label: "Code" },
  "bar-chart-3": { icon: BarChart3, label: "Analytics" },
  "megaphone": { icon: Megaphone, label: "Marketing" },
  "users": { icon: Users, label: "People" },
  "book-open": { icon: BookOpen, label: "Docs" },
  "wrench": { icon: Wrench, label: "Tooling" },
  "flask-conical": { icon: FlaskConical, label: "Research" },
}

export const projectIcons = Object.keys(iconConfig) as ProjectIcon[]
