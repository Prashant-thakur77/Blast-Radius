"""Plain-English review summary. IBM Granite on watsonx.ai when configured, template otherwise.

Env: WATSONX_APIKEY, WATSONX_PROJECT_ID, WATSONX_URL (default Dallas), WATSONX_MODEL.
The model only narrates the JSON evidence. It is told not to add facts.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.parse
import urllib.request

from app.core.config import _backend_dir  # noqa: F401  (loads .env)

MODEL = os.getenv("WATSONX_MODEL", "ibm/granite-4-h-small")
URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").rstrip("/")
_token: tuple[str, float] | None = None

SYSTEM = (
    "You write the summary line of a pull-request risk review. Use ONLY the JSON evidence given. "
    "Do not invent files, functions, numbers or risks. Mention the score and band, the most important "
    "finding with its file:line, and what the reviewer should check first. At most 4 sentences, no lists."
)


def _iam_token(apikey: str) -> str:
    global _token
    if _token and _token[1] > time.time() + 60:
        return _token[0]
    body = urllib.parse.urlencode({"grant_type": "urn:ibm:params:oauth:grant-type:apikey", "apikey": apikey}).encode()
    req = urllib.request.Request("https://iam.cloud.ibm.com/identity/token", data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    _token = (data["access_token"], time.time() + int(data.get("expires_in", 3600)))
    return _token[0]


def _evidence(report: dict) -> dict:
    return {
        "branch": report["head"],
        "score": report["score"],
        "changed": [f"{c['symbol']} ({c['file']}:{c['line']}, {c['change']})" for c in report["changed_units"][:8]],
        "dependents": len(report["ripple"]),
        "subsystems": [s["name"] for s in report["subsystems"]],
        "missed_callers": [f"{m['file']}:{m['line']} {m['reason']}" for m in report["missed_callers"]],
        "contract_changes": [f"{c['symbol']}: {c['old_params']} -> {c['new_params']}" for c in report["contract_changes"]],
        "docs_in_scope": [f"{d['file']}:{d['line']} {d['heading']}" for d in report["docs"]][:6],
    }


def template(report: dict) -> str:
    s = report["score"]
    parts = [f"Risk {s['total']}/100 ({s['band']}): {len(report['changed_units'])} changed units reach "
             f"{len(report['ripple'])} dependents across {len(report['subsystems'])} subsystems."]
    if report["missed_callers"]:
        m = report["missed_callers"][0]
        parts.append(f"{m['file']}:{m['line']} was not updated: {m['reason']}.")
    if report["contract_changes"]:
        c = report["contract_changes"][0]
        parts.append(f"{c['symbol']} changed signature ({', '.join(c['old_params'])} -> {', '.join(c['new_params'])}) with {c['callers']} callers.")
    top = max(s["factors"], key=lambda f: f["points"])
    parts.append(f"Largest factor: {top['name']} ({top['why']}).")
    return " ".join(parts)


def summarize(report: dict) -> dict:
    apikey, project = os.getenv("WATSONX_APIKEY"), os.getenv("WATSONX_PROJECT_ID")
    if not (apikey and project):
        return {"summary": template(report), "engine": "template", "model": None}
    evidence = _evidence(report)
    seed = int(hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()[:8], 16) % 2**31
    body = {
        "model_id": MODEL,
        "project_id": project,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": json.dumps(evidence)}],
        "max_tokens": 220,
        "temperature": 0,
        "seed": seed,
    }
    try:
        req = urllib.request.Request(f"{URL}/ml/v1/text/chat?version=2023-10-25", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json",
                                              "Authorization": f"Bearer {_iam_token(apikey)}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        text = data["choices"][0]["message"]["content"].strip()
        return {"summary": text, "engine": "watsonx.ai", "model": MODEL}
    except Exception as exc:  # noqa: BLE001 - never fail the review because the narrator failed
        return {"summary": template(report), "engine": "template", "model": None, "granite_error": str(exc)[:200]}
