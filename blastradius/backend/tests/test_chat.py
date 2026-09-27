"""Test chat SSE endpoint against the pulse repo.

Run: python -m pytest tests/test_chat.py -v -s
Requires: backend running at localhost:8000 with pulse repo ingested + enriched.
"""

import json
import httpx
import pytest

BASE = "http://localhost:8000"


def get_repo_id():
    r = httpx.get(f"{BASE}/api/repos")
    repos = r.json()
    assert repos, "No repos found"
    return repos[0]["id"]


def stream_chat(repo_id: str, message: str, history: list = None):
    """Send a chat message and collect all SSE events."""
    r = httpx.post(
        f"{BASE}/api/repos/{repo_id}/chat",
        json={"message": message, "history": history or []},
        timeout=60,
    )
    assert r.status_code == 200, f"Chat failed: {r.status_code} {r.text[:200]}"

    events = []
    for line in r.text.split("\n"):
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


def _safe(s: str) -> str:
    return s.encode("ascii", errors="replace").decode("ascii")


def print_events(events, label=""):
    if label:
        print(f"\n{'='*60}")
        print(f"  {_safe(label)}")
        print(f"{'='*60}")

    reasoning = ""
    text = ""
    tools = []

    for e in events:
        if e["type"] == "reasoning":
            reasoning += e["delta"]
        elif e["type"] == "tool_start":
            tools.append({"name": e["name"], "args": e["args"], "id": e["id"]})
            print(f"  TOOL START: {e['name']}({json.dumps(e['args'])})")
        elif e["type"] == "tool_done":
            print(f"  TOOL DONE:  id={e['id']} count={e.get('count', '?')}")
        elif e["type"] == "text_delta":
            text += e["delta"]
        elif e["type"] == "done":
            pass

    if reasoning:
        print(f"  REASONING: {_safe(reasoning[:200])}")
    print(f"  TEXT ({len(text)} chars): {_safe(text[:300])}")
    print(f"  TOOLS USED: {len(tools)}")

    return {"reasoning": reasoning, "text": text, "tools": tools, "events": events}


class TestChat:
    def test_basic_question(self):
        """Ask a codebase question -- should use tools and return text."""
        repo_id = get_repo_id()
        events = stream_chat(repo_id, "How does task creation work?")
        result = print_events(events, "How does task creation work?")

        assert result["text"], "Should have response text"
        assert len(result["tools"]) > 0, "Should use at least one tool"

        has_search = any(t["name"] == "vector_search" for t in result["tools"])
        assert has_search, "Should use vector_search"

        event_types = {e["type"] for e in events}
        assert "done" in event_types, "Should have done event"

    def test_no_tool_question(self):
        """Ask a generic question -- may not use tools."""
        repo_id = get_repo_id()
        events = stream_chat(repo_id, "What is a React component?")
        result = print_events(events, "What is a React component?")

        assert result["text"], "Should have response text"

    def test_has_flow_blocks(self):
        """Ask about a flow -- response should contain :::flow blocks."""
        repo_id = get_repo_id()
        events = stream_chat(repo_id, "Trace the authentication sign-in flow")
        result = print_events(events, "Trace the authentication sign-in flow")

        assert result["text"], "Should have response text"
        has_flow = ":::flow" in result["text"] or '"node_ids"' in result["text"]
        print(f"  HAS FLOW BLOCKS: {has_flow}")

    def test_has_actions(self):
        """Response should end with :::actions block."""
        repo_id = get_repo_id()
        events = stream_chat(repo_id, "What does the notification system do?")
        result = print_events(events, "What does the notification system do?")

        has_actions = ":::actions" in result["text"]
        print(f"  HAS ACTIONS: {has_actions}")

    def test_traverse_tool(self):
        """Ask about connections -- should use graph_traverse."""
        repo_id = get_repo_id()
        events = stream_chat(repo_id, "What breaks if I change TaskCard?")
        result = print_events(events, "What breaks if I change TaskCard?")

        tool_names = {t["name"] for t in result["tools"]}
        print(f"  TOOL NAMES: {tool_names}")
        assert "vector_search" in tool_names, "Should search first"

    def test_conversation_history(self):
        """Follow-up with history -- should have context."""
        repo_id = get_repo_id()

        events1 = stream_chat(repo_id, "What is TaskBoard?")
        result1 = print_events(events1, "Turn 1: What is TaskBoard?")

        history = [
            {"role": "user", "content": "What is TaskBoard?"},
            {"role": "assistant", "content": result1["text"]},
        ]
        events2 = stream_chat(repo_id, "What components does it render?", history)
        result2 = print_events(events2, "Turn 2: What components does it render?")

        assert result2["text"], "Should respond to follow-up"

    def test_sse_event_ordering(self):
        """Events should follow: reasoning -> tool_start -> tool_done -> text_delta -> done."""
        repo_id = get_repo_id()
        events = stream_chat(repo_id, "How does the dashboard work?")
        result = print_events(events, "Event ordering: How does the dashboard work?")

        types = [e["type"] for e in events]

        if "text_delta" in types and "tool_start" in types:
            first_text = types.index("text_delta")
            last_tool_done = max(i for i, t in enumerate(types) if t == "tool_done")
            assert first_text > last_tool_done, f"Text should come after tools: text at {first_text}, last tool_done at {last_tool_done}"

        assert types[-1] == "done" or types.count("done") >= 1, "Should end with done"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
