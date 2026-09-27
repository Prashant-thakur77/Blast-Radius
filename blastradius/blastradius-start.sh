#!/bin/bash

export DATA_DIR="${DATA_DIR:-/data}"
export DB_PATH="${DB_PATH:-/data/blastradius.db}"
export REPOS_DIR="${REPOS_DIR:-/data/repos}"

mkdir -p "$DATA_DIR/repos"

cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &

cd /app/frontend && npx next start -p 8080 -H 0.0.0.0 &

wait -n
