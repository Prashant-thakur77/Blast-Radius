export interface Flow {
  id: string
  label: string
  description?: string
  node_ids: string[]
  edge_keys?: EdgeKey[]
}

export interface EdgeKey {
  source: string
  target: string
  edge_type: string
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "flow"; flow: Flow }
  | { type: "actions"; actions: string[] }

const BLOCK_REGEX = /:::(flow|actions)\n([\s\S]*?)\n:::/g

export function parseContentBlocks(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  let lastIndex = 0

  for (const match of raw.matchAll(BLOCK_REGEX)) {
    const before = raw.slice(lastIndex, match.index)
    if (before.trim()) {
      blocks.push({ type: "text", text: before.trim() })
    }

    const blockType = match[1]
    const content = match[2]

    try {
      if (blockType === "flow") {
        const flow = JSON.parse(content) as Flow
        if (flow.label && flow.node_ids) {
          blocks.push({ type: "flow", flow })
        }
      } else if (blockType === "actions") {
        const actions = JSON.parse(content) as string[]
        if (Array.isArray(actions) && actions.length > 0) {
          blocks.push({ type: "actions", actions })
        }
      }
    } catch {
      blocks.push({ type: "text", text: match[0] })
    }

    lastIndex = match.index! + match[0].length
  }

  const remaining = raw.slice(lastIndex)
  if (remaining.trim()) {
    const incompleteBlock = remaining.match(/:::(flow|actions)/)
    if (incompleteBlock?.index !== undefined) {
      const before = remaining.slice(0, incompleteBlock.index)
      if (before.trim()) blocks.push({ type: "text", text: before.trim() })
    } else {
      blocks.push({ type: "text", text: remaining.trim() })
    }
  }

  return blocks
}
