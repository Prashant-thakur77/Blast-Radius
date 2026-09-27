from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.config import OPENAI_API_KEY
from app.core.database import get_session
from app.models import CodeUnit, FeatureCluster, ClusterMember, GraphEdge, ProjectGraphSnapshot, Repo
from app.services.search import get_latest_snapshot, vector_search, graph_traverse

logger = logging.getLogger("blastradius.chat")

router = APIRouter(prefix="/api/repos/{repo_id}", tags=["chat"])


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatHistoryItem] = []
    snapshot_id: str | None = None


TOOLS = [
    {
        "type": "function",
        "name": "vector_search",
        "description": "Search code units by semantic similarity against their LLM-generated descriptions. Descriptions focus on business concepts, domain entities, and user flows (NOT code syntax or framework names). Write queries that match this style.",
        "parameters": {
            "type": "object",
            "properties": {
                "queries": {"type": "array", "items": {"type": "string"}, "description": "1-3 queries using business/domain language, e.g. 'workspace task board drag reorder status columns' not 'TaskBoard component'"},
                "top_k": {"type": "integer", "description": "Number of results to return", "default": 8},
            },
            "required": ["queries"],
        },
    },
    {
        "type": "function",
        "name": "graph_traverse",
        "description": "Build a subgraph from seed node IDs. Use 'connect' mode to find paths between nodes. Use 'expand' mode to BFS outward from nodes in a direction.",
        "parameters": {
            "type": "object",
            "properties": {
                "seed_ids": {"type": "array", "items": {"type": "string"}, "description": "Node IDs to start from (from search results)"},
                "mode": {"type": "string", "enum": ["connect", "expand"], "description": "'connect' finds paths between seeds, 'expand' does BFS outward"},
                "direction": {"type": "string", "enum": ["outgoing", "incoming", "both"], "default": "both"},
                "max_depth": {"type": "integer", "default": 3, "description": "Max BFS hops"},
            },
            "required": ["seed_ids", "mode"],
        },
    },
]


def _build_system_prompt(repo: Repo, snapshot: ProjectGraphSnapshot, session: Session) -> str:
    unit_count = session.exec(
        select(func.count()).where(CodeUnit.snapshot_id == snapshot.id)
    ).one()
    edge_count = session.exec(
        select(func.count()).where(GraphEdge.snapshot_id == snapshot.id)
    ).one()

    clusters = session.exec(
        select(FeatureCluster).where(FeatureCluster.snapshot_id == snapshot.id)
    ).all()
    cluster_labels = []
    for c in clusters:
        count = session.exec(
            select(func.count()).where(ClusterMember.cluster_id == c.id)
        ).one()
        cluster_labels.append(f"{c.label} ({count} units)")

    return f"""You are a codebase exploration assistant for the **{repo.name}** repository.

You have access to a semantic code graph: {unit_count} code units, {edge_count} dependency edges.
Subsystems: {', '.join(cluster_labels) if cluster_labels else 'none detected'}.
Edge types: calls (function invocations), renders (JSX component usage), http_calls (fetch to API routes).

## Tools
- **vector_search(queries, top_k)**: find code units by semantic meaning. Pass 1-3 queries in one call (batched). Use this first.
  IMPORTANT: Queries are matched against LLM-generated descriptions that use business/domain language (e.g. "workspace task assignment notification delivery"), NOT code symbols or file paths. Write queries accordingly.
- **graph_traverse(seed_ids, mode, direction)**: build subgraphs from search results.
  - mode="connect": find how nodes relate (paths between them)
  - mode="expand" + direction="incoming": find what depends on a node
  - mode="expand" + direction="outgoing": find what a node uses

## Response style
- Explain the LOGIC, not the files. Say "the comment form submits to the API, which persists and notifies the assignee" — NOT "src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/route.ts::POST calls src/features/comments/mutations.ts::createComment".
- Use symbol names (TaskBoard, createTask, notifyTaskAssigned) but NEVER full file paths in prose.
- Be concise. 2-4 short paragraphs max. No numbered lists unless truly needed.
- Lead with the high-level answer, then add flow blocks for the details.

## Flow blocks
Include :::flow blocks to highlight paths in the graph. Use the **integer index** (e.g. #0, #3) from tool results to reference nodes. NEVER copy UUIDs.

:::flow
{{"id":"unique-id","label":"Flow Name","description":"Short description","node_ids":["#0","#2","#5"],"edge_keys":[{{"source":"#0","target":"#2","edge_type":"calls"}}]}}
:::

## Rules
- Use exactly 1 vector_search call (with up to 3 queries) and optionally 1 graph_traverse call. No more.
- If a follow-up can be answered from prior tool results, do NOT search again.
- Max 3 flow blocks per response. Each flow max 5 nodes.
- ONLY use #N index references in node_ids and edge_keys. NEVER paste raw UUIDs.
- Do NOT include :::actions blocks."""


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({**data, 'type': event_type})}\n\n"


@router.post("/chat")
async def chat_stream(
    repo_id: str,
    body: ChatRequest,
    session: Session = Depends(get_session),
):
    repo = session.get(Repo, repo_id)
    if not repo:
        raise HTTPException(404, "Repo not found")

    snapshot = get_latest_snapshot(repo_id, body.snapshot_id, session)
    if not snapshot:
        raise HTTPException(400, "No snapshots found")

    system_prompt = _build_system_prompt(repo, snapshot, session)
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    messages: list[dict] = []
    for h in body.history:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": body.message})

    node_registry: dict[str, dict] = {}  # index_key "#N" -> {id, qualname}

    def register_node(node_id: str, qualname: str) -> str:
        for key, val in node_registry.items():
            if val["id"] == node_id:
                return key
        idx = len(node_registry)
        key = f"#{idx}"
        node_registry[key] = {"id": node_id, "qualname": qualname}
        return key

    def resolve_indices(text: str) -> str:
        import re
        def replace_flow(m: re.Match) -> str:
            try:
                flow = json.loads(m.group(2))
                if "node_ids" in flow:
                    flow["node_ids"] = [
                        node_registry.get(ref, {}).get("id", ref) if ref.startswith("#") else ref
                        for ref in flow["node_ids"]
                    ]
                if "edge_keys" in flow:
                    for ek in flow["edge_keys"]:
                        if isinstance(ek.get("source"), str) and ek["source"].startswith("#"):
                            reg = node_registry.get(ek["source"], {})
                            ek["source"] = reg.get("qualname", ek["source"])
                        if isinstance(ek.get("target"), str) and ek["target"].startswith("#"):
                            reg = node_registry.get(ek["target"], {})
                            ek["target"] = reg.get("qualname", ek["target"])
                return f":::{m.group(1)}\n{json.dumps(flow)}\n:::"
            except (json.JSONDecodeError, KeyError):
                return m.group(0)
        return re.sub(r":::(flow)\n([\s\S]*?)\n:::", replace_flow, text)

    async def generate():
        nonlocal messages
        tool_counter = 0
        previous_response_id = None

        while True:
            create_kwargs: dict = {
                "model": "gpt-5.4-mini",
                "instructions": system_prompt,
                "tools": TOOLS,
                "stream": True,
                "reasoning": {"effort": "medium", "summary": "auto"},
            }

            if previous_response_id:
                create_kwargs["previous_response_id"] = previous_response_id
                create_kwargs["input"] = tool_outputs
            else:
                create_kwargs["input"] = messages

            response = await client.responses.create(**create_kwargs)

            pending_tool_calls: dict[str, dict] = {}
            has_tool_call = False
            response_id = None
            tool_outputs = []

            full_text = ""

            async for event in response:
                if event.type == "response.created":
                    response_id = event.response.id

                elif event.type == "response.reasoning_summary_text.delta":
                    yield _sse("reasoning", {"delta": event.delta})

                elif event.type == "response.output_text.delta":
                    full_text += event.delta
                    yield _sse("text_delta", {"delta": event.delta})

                elif event.type == "response.output_item.added":
                    if hasattr(event.item, "name") and event.item.name:
                        pending_tool_calls[event.item.id] = {
                            "name": event.item.name,
                            "call_id": event.item.call_id if hasattr(event.item, "call_id") else event.item.id,
                        }

                elif event.type == "response.function_call_arguments.done":
                    has_tool_call = True
                    item_id = event.item_id
                    tool_info = pending_tool_calls.get(item_id, {})
                    tool_name = tool_info.get("name", "")
                    call_id = tool_info.get("call_id", item_id)
                    args_json = event.arguments

                    try:
                        args = json.loads(args_json)
                    except json.JSONDecodeError:
                        args = {}

                    tool_counter += 1
                    tid = f"t{tool_counter}"
                    logger.info(f"tool_call: {tool_name}({json.dumps(args)})")
                    yield _sse("tool_start", {"id": tid, "name": tool_name, "args": args})

                    try:
                        if tool_name == "vector_search":
                            queries = args.get("queries", [])
                            if isinstance(queries, str):
                                queries = [queries]
                            result = await vector_search(
                                repo_id, snapshot, queries, args.get("top_k", 8), session,
                            )
                            logger.info(f"tool_result: {tool_name} -> {len(result)} results")

                            indexed_result = []
                            summary = []
                            for r in result[:8]:
                                idx = register_node(r["id"], r["qualname"])
                                indexed_result.append({**r, "index": idx})
                                summary.append({"name": r["symbol_name"], "kind": r["kind"], "sim": r.get("similarity", 0)})

                            yield _sse("tool_done", {"id": tid, "count": len(result), "summary": summary})
                            tool_output = json.dumps(indexed_result, default=str)

                        elif tool_name == "graph_traverse":
                            seed_ids = args.get("seed_ids", [])
                            resolved_seeds = [
                                node_registry.get(s, {}).get("id", s) if s.startswith("#") else s
                                for s in seed_ids
                            ]
                            result = graph_traverse(
                                snapshot, resolved_seeds,
                                args.get("mode", "connect"), args.get("direction", "both"),
                                args.get("max_depth", 3), 30, session,
                            )
                            logger.info(f"tool_result: {tool_name} -> {len(result['nodes'])} nodes, {len(result['edges'])} edges")

                            indexed_nodes = []
                            for n in result["nodes"]:
                                idx = register_node(n["id"], n["qualname"])
                                indexed_nodes.append({**n, "index": idx})

                            indexed_edges = []
                            for e in result["edges"]:
                                src_idx = register_node(e["source_id"], e["source_qualname"])
                                tgt_idx = register_node(e["target_id"], e["target_qualname"])
                                indexed_edges.append({**e, "source_index": src_idx, "target_index": tgt_idx})

                            chains: list[str] = []
                            for e in indexed_edges[:12]:
                                src = e["source_qualname"].split("::")[-1]
                                tgt = e["target_qualname"].split("::")[-1]
                                chains.append(f"{e['source_index']} {src} -> {e['target_index']} {tgt}")

                            yield _sse("tool_done", {
                                "id": tid,
                                "count": len(result["nodes"]),
                                "edges": len(result["edges"]),
                                "chains": chains,
                            })
                            tool_output = json.dumps({"nodes": indexed_nodes, "edges": indexed_edges}, default=str)
                        else:
                            tool_output = json.dumps({"error": f"Unknown tool: {tool_name}"})
                            yield _sse("tool_done", {"id": tid, "count": 0})
                    except Exception as e:
                        logger.error(f"Tool {tool_name} failed: {e}")
                        tool_output = json.dumps({"error": str(e)})
                        yield _sse("tool_done", {"id": tid, "count": 0})

                    tool_outputs.append({
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": tool_output,
                    })

            previous_response_id = response_id

            if not has_tool_call:
                resolved_text = resolve_indices(full_text)
                if resolved_text != full_text:
                    logger.info(f"resolved {len(node_registry)} node indices in flow blocks")
                logger.info(f"chat response ({len(resolved_text)} chars):\n{resolved_text}")
                if resolved_text != full_text:
                    yield _sse("replace_text", {"text": resolved_text})
                yield _sse("done", {})
                return

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
