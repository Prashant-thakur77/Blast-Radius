"""Test search and traverse endpoints against the pulse repo graph.

Run: python -m pytest tests/test_search_traverse.py -v -s
Requires: backend running at localhost:8000 with pulse repo ingested + enriched.
"""

import json
import httpx
import pytest

BASE = "http://localhost:8000"
REPO_ID = None


def get_repo_id():
    global REPO_ID
    if REPO_ID:
        return REPO_ID
    r = httpx.get(f"{BASE}/api/repos")
    repos = r.json()
    assert repos, "No repos found -- ingest pulse first"
    REPO_ID = repos[0]["id"]
    return REPO_ID


def search(query: str, top_k: int = 5):
    r = httpx.post(
        f"{BASE}/api/repos/{get_repo_id()}/search",
        json={"query": query, "top_k": top_k},
        timeout=30,
    )
    assert r.status_code == 200, f"Search failed: {r.text}"
    return r.json()


def traverse(seed_ids: list[str], mode: str = "connect", max_depth: int = 3, max_nodes: int = 30, direction: str = "both"):
    r = httpx.post(
        f"{BASE}/api/repos/{get_repo_id()}/traverse",
        json={
            "seed_ids": seed_ids,
            "mode": mode,
            "max_depth": max_depth,
            "max_nodes": max_nodes,
            "direction": direction,
        },
        timeout=10,
    )
    assert r.status_code == 200, f"Traverse failed: {r.text}"
    return r.json()


def print_search_results(data, label=""):
    if label:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"{'='*60}")
    for r in data["results"]:
        print(f"  [{r['similarity']:.3f}] {r['symbol_name']} ({r['kind']}) -- {r['file_path']}")
        if r.get("llm_description"):
            print(f"          {r['llm_description'][:80]}")
        for n in r.get("neighbors", [])[:3]:
            arrow = "->" if n["direction"] == "outgoing" else "<-"
            print(f"          {arrow} {n['edge_type']} {n['symbol_name']} ({n['kind']})")


def print_traverse_results(data, label=""):
    if label:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"{'='*60}")
    seeds = [n for n in data["nodes"] if n["is_seed"]]
    others = [n for n in data["nodes"] if not n["is_seed"]]
    print(f"  Nodes: {len(data['nodes'])} ({len(seeds)} seeds, {len(others)} discovered)")
    print(f"  Edges: {len(data['edges'])}")
    for n in seeds:
        print(f"  [SEED] {n['symbol_name']} ({n['kind']}) -- {n['file_path']}")
    for n in others[:10]:
        print(f"         {n['symbol_name']} ({n['kind']}) -- {n['file_path']}")
    if len(others) > 10:
        print(f"         ... and {len(others) - 10} more")
    for e in data["edges"][:10]:
        print(f"  {e['source_qualname'].split('::')[-1]} --({e['edge_type']})-> {e['target_qualname'].split('::')[-1]}")


class TestSearch:
    def test_task_management(self):
        """Search for task-related code -- should find TaskBoard, TaskCard, createTask, etc."""
        data = search("task management kanban board")
        print_search_results(data, "task management kanban board")
        names = {r["symbol_name"] for r in data["results"]}
        assert len(data["results"]) > 0
        assert any("task" in n.lower() or "Task" in n for n in names), f"Expected task-related results, got: {names}"

    def test_authentication(self):
        """Search for auth -- should find sign-in, sign-up, session functions."""
        data = search("authentication sign in login session")
        print_search_results(data, "authentication sign in login session")
        names = {r["symbol_name"].lower() for r in data["results"]}
        assert len(data["results"]) > 0
        has_auth = any("auth" in n or "sign" in n or "session" in n or "login" in n for n in names)
        assert has_auth, f"Expected auth-related results, got: {names}"

    def test_notifications(self):
        """Search for notification system -- should find notify functions."""
        data = search("notification system notify user")
        print_search_results(data, "notification system notify user")
        assert len(data["results"]) > 0

    def test_comments(self):
        """Search for comment feature -- should find CommentForm, createComment."""
        data = search("task comments discussion")
        print_search_results(data, "task comments discussion")
        assert len(data["results"]) > 0

    def test_dashboard(self):
        """Search for dashboard components."""
        data = search("dashboard overview projects tasks")
        print_search_results(data, "dashboard overview projects tasks")
        assert len(data["results"]) > 0

    def test_neighbors_present(self):
        """Verify search results include 1-hop neighbors."""
        data = search("task board component", top_k=3)
        has_neighbors = any(len(r.get("neighbors", [])) > 0 for r in data["results"])
        assert has_neighbors, "Expected at least one result with neighbors"
        print_search_results(data, "task board component (checking neighbors)")

    def test_similarity_ordering(self):
        """Results should be ordered by decreasing similarity."""
        data = search("workspace settings members", top_k=10)
        sims = [r["similarity"] for r in data["results"]]
        assert sims == sorted(sims, reverse=True), f"Results not sorted by similarity: {sims}"


class TestTraverse:
    def _get_seed_ids(self, query: str, top_k: int = 3) -> list[str]:
        data = search(query, top_k=top_k)
        return [r["id"] for r in data["results"]]

    def test_connect_task_flow(self):
        """Connect task-related nodes -- should find paths between TaskBoard, createTask, notifyTaskAssigned."""
        seeds_board = self._get_seed_ids("task board kanban", top_k=2)
        seeds_notify = self._get_seed_ids("notify task assigned", top_k=2)
        all_seeds = list(set(seeds_board + seeds_notify))[:4]
        data = traverse(all_seeds, mode="connect", max_depth=3)
        print_traverse_results(data, "CONNECT: task board <-> notify assigned")
        assert len(data["nodes"]) >= len(all_seeds), "Should have at least the seed nodes"
        assert len(data["edges"]) > 0, "Should find connecting edges"

    def test_expand_outgoing_from_task_card(self):
        """Expand outgoing from TaskCard -- what does it render/call?"""
        seeds = self._get_seed_ids("TaskCard component", top_k=1)
        data = traverse(seeds, mode="expand", direction="outgoing", max_depth=2)
        print_traverse_results(data, "EXPAND outgoing: TaskCard")
        assert len(data["nodes"]) >= 1

    def test_expand_incoming_to_api_handler(self):
        """Expand incoming to a task API handler -- who calls it?"""
        seeds = self._get_seed_ids("create task api handler POST", top_k=1)
        data = traverse(seeds, mode="expand", direction="incoming", max_depth=2)
        print_traverse_results(data, "EXPAND incoming: task POST handler")
        assert len(data["nodes"]) >= 1

    def test_budget_cap(self):
        """Verify max_nodes budget is respected."""
        seeds = self._get_seed_ids("dashboard", top_k=2)
        data = traverse(seeds, mode="expand", direction="both", max_depth=5, max_nodes=10)
        assert len(data["nodes"]) <= 10, f"Budget exceeded: {len(data['nodes'])} nodes"
        print_traverse_results(data, "EXPAND both (budget=10): dashboard")

    def test_connect_auth_to_workspace(self):
        """Connect auth flow to workspace creation -- should trace sign-up -> create workspace."""
        seeds_auth = self._get_seed_ids("sign up create user", top_k=2)
        seeds_ws = self._get_seed_ids("create workspace", top_k=2)
        all_seeds = list(set(seeds_auth + seeds_ws))[:4]
        data = traverse(all_seeds, mode="connect", max_depth=4)
        print_traverse_results(data, "CONNECT: auth sign-up <-> workspace creation")


class TestEndToEnd:
    def test_how_does_task_creation_work(self):
        """Simulate: 'How does task creation work?'
        1. Search for task creation
        2. Traverse to connect the pieces
        3. Verify we get a coherent subgraph
        """
        print("\n" + "="*60)
        print("  E2E: How does task creation work?")
        print("="*60)

        s1 = search("create task form", top_k=3)
        print_search_results(s1, "Step 1: search 'create task form'")

        s2 = search("task API handler POST create", top_k=3)
        print_search_results(s2, "Step 2: search 'task API handler POST create'")

        all_ids = list({r["id"] for r in s1["results"] + s2["results"]})[:6]
        print(f"\n  Collected {len(all_ids)} unique seed IDs")

        subgraph = traverse(all_ids, mode="connect", max_depth=3, max_nodes=30)
        print_traverse_results(subgraph, "Step 3: traverse/connect")

        assert len(subgraph["nodes"]) >= 2, "Should find connected nodes"
        assert len(subgraph["edges"]) >= 1, "Should find connecting edges"

    def test_what_breaks_if_i_change_task_card(self):
        """Simulate: 'What breaks if I change TaskCard?'
        1. Search for TaskCard
        2. Expand incoming to find dependents
        """
        print("\n" + "="*60)
        print("  E2E: What breaks if I change TaskCard?")
        print("="*60)

        s1 = search("TaskCard component render", top_k=2)
        print_search_results(s1, "Step 1: search 'TaskCard component render'")

        seeds = [r["id"] for r in s1["results"]][:2]
        impact = traverse(seeds, mode="expand", direction="incoming", max_depth=2, max_nodes=20)
        print_traverse_results(impact, "Step 2: expand incoming from TaskCard")

        assert len(impact["nodes"]) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
