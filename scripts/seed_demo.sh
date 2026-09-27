#!/usr/bin/env bash
# Build demo-workspace/pulse: a git repo with `main` plus three seeded PR branches.
# Same result every run, fully offline. BlastRadius and Bob review these branches.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/demo-workspace/pulse"
GIT=(git -c user.name="BlastRadius Demo" -c user.email=demo@blastradius.local -c commit.gpgsign=false)

rm -rf "$WS"
mkdir -p "$WS"
rsync -a --exclude node_modules --exclude .next --exclude 'sqlite.db*' --exclude '*.tsbuildinfo' "$ROOT/pulse/" "$WS/"
cd "$WS"
"${GIT[@]}" init -q -b main
"${GIT[@]}" add -A
"${GIT[@]}" commit -qm "Pulse baseline"

for pr in pr-1-dashboard-copy pr-2-session-epoch pr-3-task-archiving; do
  "${GIT[@]}" checkout -q -b "$pr" main
  "${GIT[@]}" apply --whitespace=nowarn "$ROOT/demo/prs/$pr.patch"
  "${GIT[@]}" add -A
  "${GIT[@]}" commit -qm "$(head -1 "$ROOT/demo/prs/$pr.md" | sed 's/^# //')"
done
"${GIT[@]}" checkout -q main

# Share pulse's installed dependencies so vitest runs without another install.
if [ -d "$ROOT/pulse/node_modules" ] && [ ! -e node_modules ]; then
  ln -s "$ROOT/pulse/node_modules" node_modules
fi
echo "Seeded $WS"
git --no-pager branch --format='  %(refname:short)'
