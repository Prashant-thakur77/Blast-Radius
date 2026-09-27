"""Test hub score computation and filtering.

Run: python -m pytest tests/test_hub_scores.py -v -s
Requires: backend running at localhost:8000 with pulse repo ingested + enriched.
"""

import httpx
import pytest

BASE = "http://localhost:8000"


def get_repo_id():
    r = httpx.get(f"{BASE}/api/repos")
    repos = r.json()
    assert repos, "No repos found"
    return repos[0]["id"]


def get_graph(repo_id: str):
    r = httpx.get(f"{BASE}/api/repos/{repo_id}/graph", timeout=10)
    assert r.status_code == 200
    return r.json()


def search(repo_id: str, query: str, top_k: int = 5):
    r = httpx.post(
        f"{BASE}/api/repos/{repo_id}/search",
        json={"query": query, "top_k": top_k},
        timeout=30,
    )
    assert r.status_code == 200
    return r.json()


def traverse(repo_id: str, seed_ids: list[str], mode: str = "connect", **kwargs):
    r = httpx.post(
        f"{BASE}/api/repos/{repo_id}/traverse",
        json={"seed_ids": seed_ids, "mode": mode, **kwargs},
        timeout=10,
    )
    assert r.status_code == 200
    return r.json()


class TestHubScores:
    def test_hub_scores_computed(self):
        """All nodes should have hub_score values after enrichment."""
        repo_id = get_repo_id()
        graph = get_graph(repo_id)
        scores = [n["hub_score"] for n in graph["nodes"]]
        assert len(scores) > 0
        assert max(scores) > 0, "At least one node should have non-zero hub_score"
        print(f"  Nodes: {len(scores)}, max hub_score: {max(scores):.4f}, min: {min(scores):.4f}")

    def test_known_hubs_detected(self):
        """cn, Button should have high hub_score."""
        repo_id = get_repo_id()
        graph = get_graph(repo_id)
        by_name = {n["symbol_name"]: n for n in graph["nodes"]}

        known_hubs = ["cn", "Button"]
        for name in known_hubs:
            node = by_name.get(name)
            if node:
                print(f"  {name}: hub_score={node['hub_score']:.4f}")
                assert node["hub_score"] > 0.15, f"{name} should be detected as hub, got {node['hub_score']}"

    def test_domain_nodes_not_hubs(self):
        """Domain-specific functions should NOT be hubs."""
        repo_id = get_repo_id()
        graph = get_graph(repo_id)
        by_name = {n["symbol_name"]: n for n in graph["nodes"]}

        domain_nodes = ["createTask", "signInUser", "notifyTaskAssigned", "TaskBoard"]
        for name in domain_nodes:
            node = by_name.get(name)
            if node:
                print(f"  {name}: hub_score={node['hub_score']:.4f}")
                assert node["hub_score"] <= 0.15, f"{name} should NOT be a hub, got {node['hub_score']}"

    def test_search_neighbors_exclude_hubs(self):
        """Search results should not include hub nodes as neighbors."""
        repo_id = get_repo_id()
        data = search(repo_id, "task board kanban", top_k=3)
        hub_names = {"cn", "Button", "Badge"}
        for r in data["results"]:
            neighbor_names = {n["symbol_name"] for n in r.get("neighbors", [])}
            leaked = neighbor_names & hub_names
            assert not leaked, f"Hub nodes leaked into neighbors of {r['symbol_name']}: {leaked}"
            print(f"  {r['symbol_name']}: {len(r['neighbors'])} neighbors, no hubs")

    def test_traverse_excludes_hubs(self):
        """Traverse connect should not pass through high-hub nodes."""
        repo_id = get_repo_id()
        graph = get_graph(repo_id)
        actual_hubs = {n["symbol_name"] for n in graph["nodes"] if n["hub_score"] > 0.15}
        print(f"  Actual hubs (>0.15): {actual_hubs}")

        s1 = search(repo_id, "task creation form dialog", top_k=2)
        s2 = search(repo_id, "create task mutation persist", top_k=2)
        all_ids = list({r["id"] for r in s1["results"] + s2["results"]})[:4]

        data = traverse(repo_id, all_ids, mode="connect", max_depth=3)
        node_names = {n["symbol_name"] for n in data["nodes"]}

        leaked = node_names & actual_hubs
        assert not leaked, f"Hub nodes in traverse result: {leaked}"
        print(f"  Traverse nodes: {node_names}")
        print(f"  No hubs leaked")

    def test_traverse_expand_excludes_hubs(self):
        """Expand from a node should not follow edges through hubs."""
        repo_id = get_repo_id()
        graph = get_graph(repo_id)
        actual_hubs = {n["symbol_name"] for n in graph["nodes"] if n["hub_score"] > 0.15}

        s = search(repo_id, "TaskCard component", top_k=1)
        seeds = [r["id"] for r in s["results"]]

        data = traverse(repo_id, seeds, mode="expand", direction="outgoing", max_depth=2)
        node_names = {n["symbol_name"] for n in data["nodes"]}

        leaked = node_names & actual_hubs
        assert not leaked, f"Hub nodes in expand result: {leaked}"
        print(f"  Expand from TaskCard: {node_names}")

    def test_hub_score_distribution(self):
        """Check the distribution makes sense - few hubs, many normal nodes."""
        repo_id = get_repo_id()
        graph = get_graph(repo_id)

        total = len(graph["nodes"])
        hubs = [n for n in graph["nodes"] if n["hub_score"] > 0.15]
        high_hubs = [n for n in graph["nodes"] if n["hub_score"] > 0.5]

        print(f"  Total nodes: {total}")
        print(f"  Hub nodes (>0.15): {len(hubs)} ({len(hubs)/total*100:.1f}%)")
        print(f"  High hubs (>0.5): {len(high_hubs)} ({len(high_hubs)/total*100:.1f}%)")
        for h in sorted(high_hubs, key=lambda x: -x["hub_score"])[:10]:
            print(f"    {h['symbol_name']} ({h['kind']}): {h['hub_score']:.4f}")

        assert len(hubs) < total * 0.15, f"Too many hubs: {len(hubs)}/{total}"
        assert len(hubs) > 0, "Should detect at least some hubs"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
