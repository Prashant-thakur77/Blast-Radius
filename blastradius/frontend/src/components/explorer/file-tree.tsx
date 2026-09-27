"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode,
  Box,
  Braces,
  Anchor,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeUnitNode {
  id: string
  qualname: string
  symbol_name: string
  file_path: string
  kind: string
  runtime: string
  start_line: number
}

interface GraphResponse {
  nodes: CodeUnitNode[]
}

interface TreeNode {
  name: string
  path: string
  type: "folder" | "file" | "unit"
  kind?: string
  runtime?: string
  unitId?: string
  startLine?: number
  children: TreeNode[]
}

interface FileTreeProps {
  repoId: string
  snapshotId?: string | null
  onSelectUnit?: (unitId: string) => void
  onSelectFile?: (filePath: string | null) => void
}

function buildTree(nodes: CodeUnitNode[]): TreeNode[] {
  const virtualRoot: TreeNode = { name: "", path: "", type: "folder", children: [] }
  const lookup = new Map<string, TreeNode>()
  lookup.set("", virtualRoot)

  function ensureFolder(path: string): TreeNode {
    if (lookup.has(path)) return lookup.get(path)!
    const segments = path.split("/")
    const parentPath = segments.slice(0, -1).join("/")
    const parent = ensureFolder(parentPath)
    const node: TreeNode = { name: segments[segments.length - 1], path, type: "folder", children: [] }
    lookup.set(path, node)
    parent.children.push(node)
    return node
  }

  function ensureFile(filePath: string): TreeNode {
    if (lookup.has(filePath)) return lookup.get(filePath)!
    const segments = filePath.split("/")
    const parentPath = segments.slice(0, -1).join("/")
    const parent = parentPath ? ensureFolder(parentPath) : virtualRoot
    const node: TreeNode = { name: segments[segments.length - 1], path: filePath, type: "file", children: [] }
    lookup.set(filePath, node)
    parent.children.push(node)
    return node
  }

  for (const unit of nodes) {
    const filePath = unit.file_path.replace(/\\/g, "/")
    const fileNode = ensureFile(filePath)
    fileNode.children.push({
      name: unit.symbol_name,
      path: `${filePath}::${unit.symbol_name}`,
      type: "unit",
      kind: unit.kind,
      runtime: unit.runtime,
      unitId: unit.id,
      startLine: unit.start_line,
      children: [],
    })
  }

  function sortNode(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.type === "unit" && b.type === "unit") return (a.startLine ?? 0) - (b.startLine ?? 0)
      if (a.type !== b.type) {
        const order = { folder: 0, file: 1, unit: 2 }
        return order[a.type] - order[b.type]
      }
      return a.name.localeCompare(b.name)
    })
    for (const child of node.children) sortNode(child)
  }

  sortNode(virtualRoot)
  return virtualRoot.children
}

function getDefaultExpanded(tree: TreeNode[], depth = 0, max = 2): Set<string> {
  const set = new Set<string>()
  if (depth >= max) return set
  for (const node of tree) {
    if (node.type === "folder") {
      set.add(node.path)
      for (const p of getDefaultExpanded(node.children, depth + 1, max)) {
        set.add(p)
      }
    }
  }
  return set
}

const kindIcons: Record<string, typeof Box> = {
  component: Box,
  function: Braces,
  hook: Anchor,
  api_handler: Globe,
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onSelectUnit,
  onSelectFile,
  selectedPath,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  onSelectUnit?: (unitId: string) => void
  onSelectFile?: (filePath: string | null) => void
  selectedPath?: string | null
}) {
  const isExpanded = expanded.has(node.path)
  const hasChildren = node.children.length > 0
  const isUnit = node.type === "unit"
  const isFile = node.type === "file"
  const isSelected = node.path === selectedPath

  const KindIcon = isUnit ? kindIcons[node.kind ?? ""] ?? Braces : null

  const handleClick = () => {
    if (isUnit && node.unitId) {
      onSelectUnit?.(node.unitId)
    } else if (isFile) {
      if (isExpanded) {
        onSelectFile?.(null)
      } else {
        onSelectFile?.(node.path)
      }
      onToggle(node.path)
    } else if (hasChildren) {
      onToggle(node.path)
    }
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex items-center w-full h-[22px] text-left cursor-pointer hover:bg-accent/50 [&:hover>.kind-hint]:inline",
          isSelected && "bg-accent",
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={handleClick}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {hasChildren && !isUnit ? (
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground/70 transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          ) : null}
        </span>

        <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-1">
          {node.type === "folder" ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/80" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-muted-foreground/80" />
            )
          ) : node.type === "file" ? (
            <FileCode className="h-3.5 w-3.5 text-muted-foreground/60" />
          ) : KindIcon ? (
            <KindIcon className="h-3 w-3 text-muted-foreground/50" />
          ) : null}
        </span>

        <span
          className={cn(
            "text-[12px] truncate",
            isUnit ? "text-muted-foreground" : "text-foreground/90",
          )}
        >
          {node.name}
        </span>

        {isUnit && node.kind && (
          <span className="kind-hint ml-auto pr-2 text-[10px] text-muted-foreground/40 shrink-0 hidden">
            {node.kind}
          </span>
        )}
      </button>

      {isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onSelectUnit={onSelectUnit}
            onSelectFile={onSelectFile}
            selectedPath={selectedPath}
          />
        ))}
    </>
  )
}

export function FileTree({ repoId, snapshotId, onSelectUnit, onSelectFile }: FileTreeProps) {
  const [nodes, setNodes] = useState<CodeUnitNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const url = snapshotId
      ? `/api/repos/${repoId}/graph?snapshot_id=${snapshotId}`
      : `/api/repos/${repoId}/graph`

    fetch(url)
      .then((r) => (r.ok ? r.json() : { nodes: [] }))
      .then((data: GraphResponse) => setNodes(data.nodes))
      .catch(() => setNodes([]))
  }, [repoId, snapshotId])

  const tree = useMemo(() => buildTree(nodes), [nodes])

  useEffect(() => {
    if (tree.length > 0 && !initialized) {
      setExpanded(getDefaultExpanded(tree))
      setInitialized(true)
    }
  }, [tree, initialized])

  const handleToggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleSelectUnit = (unitId: string) => {
    const unit = nodes.find((n) => n.id === unitId)
    setSelectedPath(unit ? `${unit.file_path}::${unit.symbol_name}` : null)
    onSelectUnit?.(unitId)
  }

  const handleSelectFile = (filePath: string | null) => {
    setSelectedPath(filePath)
    onSelectFile?.(filePath)
  }

  if (nodes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/50 text-center py-4">
        No files yet
      </p>
    )
  }

  return (
    <div className="w-full overflow-x-hidden overflow-y-auto py-1 select-none">
      {tree.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
          onSelectUnit={handleSelectUnit}
          onSelectFile={handleSelectFile}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}
