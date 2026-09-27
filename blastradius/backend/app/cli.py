"""BlastRadius command line.

  python -m app.cli review --repo PATH --base main --head BRANCH [--json] [--fail-on 70]
  python -m app.cli graph  --repo PATH [--ref HEAD]

Exit codes: 0 ok, 2 score >= --fail-on or missed callers found with --fail-on-missed, 1 error.
"""

from __future__ import annotations

import argparse
import json
import sys

from app.review import engine

BAND_COLOR = {"low": "\033[32m", "medium": "\033[33m", "high": "\033[38;5;208m", "critical": "\033[31m"}
RESET, DIM, BOLD = "\033[0m", "\033[2m", "\033[1m"


def _bar(points: int, maximum: int, width: int = 20) -> str:
    filled = round(width * points / maximum) if maximum else 0
    return "█" * filled + "·" * (width - filled)


def print_report(r: dict) -> None:
    s = r["score"]
    c = BAND_COLOR.get(s["band"], "")
    st = r["stats"]
    print(f"\n{BOLD}BlastRadius{RESET}  {r['head']} → {r['base']}   {DIM}{r['head_sha'][:8]}{RESET}")
    print(f"{c}{BOLD}Risk {s['total']}/100  {s['band'].upper()}{RESET}   "
          f"diff: {st['diff']['files']} files +{st['diff']['insertions']} -{st['diff']['deletions']}   "
          f"blast radius: {st['files_in_radius']} files, {len(r['ripple'])} more dependents outside the diff, {len(r['subsystems'])} subsystems   "
          f"{DIM}{st['analysis_ms']} ms{RESET}\n")
    for f in s["factors"]:
        print(f"  {f['name']:<15} {_bar(f['points'], f['max'])} {f['points']:>3}/{f['max']:<3} {DIM}{f['why']}{RESET}")
    if r["missed_callers"]:
        print(f"\n{BAND_COLOR['critical']}{BOLD}Missed callers{RESET}")
        for m in r["missed_callers"]:
            print(f"  ✗ {m['file']}:{m['line']}\n    {m['call']}\n    {DIM}{m['reason']}{RESET}")
    if r["contract_changes"]:
        print(f"\n{BOLD}Signature changes{RESET}")
        for cc in r["contract_changes"]:
            print(f"  {cc['symbol']}({', '.join(cc['old_params'])}) → ({', '.join(cc['new_params'])})  {DIM}{cc['callers']} callers{RESET}")
    print(f"\n{BOLD}Subsystems{RESET}")
    for sub in r["subsystems"][:10]:
        print(f"  {sub['name']:<16} changed {sub['changed']:>2}   ripple {sub['ripple']:>2}")
    if r["docs"]:
        print(f"\n{BOLD}ADRs and docs in scope{RESET}")
        seen = set()
        for d in r["docs"]:
            if d["file"] in seen:
                continue
            seen.add(d["file"])
            print(f"  {d['file']}:{d['line']}  {d['title']}")
    print()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="blastradius")
    sub = ap.add_subparsers(dest="cmd", required=True)
    rv = sub.add_parser("review", help="blast radius of a branch")
    rv.add_argument("--repo", default=".")
    rv.add_argument("--base", default="main")
    rv.add_argument("--head", required=True)
    rv.add_argument("--source-root", default=None)
    rv.add_argument("--json", action="store_true", help="print the full report as JSON")
    rv.add_argument("--fail-on", type=int, default=None, help="exit 2 when the score is >= this")
    rv.add_argument("--fail-on-missed", action="store_true", help="exit 2 when any caller was not updated")
    gr = sub.add_parser("graph", help="summarize the code graph at a ref")
    gr.add_argument("--repo", default=".")
    gr.add_argument("--ref", default="HEAD")
    args = ap.parse_args(argv)

    try:
        if args.cmd == "graph":
            g = engine.build_graph_at(args.repo, args.ref)
            print(json.dumps({"sha": g.sha, "units": len(g.units), "edges": len(g.edges), "parse_ms": g.parse_ms}, indent=2))
            return 0
        report = engine.analyze_refs(args.repo, args.base, args.head, args.source_root)
    except Exception as exc:  # noqa: BLE001
        print(f"blastradius: error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)
    if args.fail_on is not None and report["score"]["total"] >= args.fail_on:
        return 2
    if args.fail_on_missed and report["missed_callers"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
