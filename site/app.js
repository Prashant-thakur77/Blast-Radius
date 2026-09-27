import { createGraphScene } from "./graph3d.js"

const REPO_URL = "https://github.com/Prashant-thakur77/Blast-Radius" // replaced at publish time by scripts/export_site_data.py --repo-url
const $ = (s, el = document) => el.querySelector(s)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

const LABELS = [
  [{ q: "src/features/dashboard/components/my-tasks-list.tsx::MyTasksList", html: "MyTasksList <small>1 dependent</small>", at: 0.7 }],
  [{ q: "src/features/auth/session.ts::getSession", html: "getSession <small>24 callers</small>", at: 0.6 }],
  [
    { q: "src/features/workspace/queries.ts::getWorkspaceMember", html: "getWorkspaceMember <small>args reordered</small>", at: 0.6 },
    { q: "src/app/api/workspaces/[id]/projects/[projectId]/tasks/[taskId]/comments/[commentId]/route.ts::authorize", html: "comments/[commentId]/route.ts:18 <small>left behind</small>", red: true, at: 1.4 },
  ],
]

const SHORT = ["PR-1", "PR-2", "PR-3"]

async function main() {
  const [graph, reports] = await Promise.all([
    fetch("data/graph.json").then((r) => r.json()),
    fetch("data/reports.json").then((r) => r.json()),
  ])
  for (const a of document.querySelectorAll("#repo-link, #repo-cta")) a.href = REPO_URL

  const scene = createGraphScene({ canvas: $("#graph"), labels: $("#labels"), graph })
  scene.start()
  let current = -1

  function select(i, scroll = false) {
    current = i
    const r = reports[i]
    document.querySelectorAll(".pr-seg button").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.pr === i)))
    scene.setReport(r, LABELS[i])
    const pill = $("#pill")
    pill.className = "pill " + r.score.band
    const headline = r.missed_callers.length
      ? `Risk ${r.score.total} · ${r.score.band} · 1 caller left behind`
      : `Risk ${r.score.total} · ${r.score.band} · ${r.ripple.length} dependents in ${r.subsystems.length} subsystem${r.subsystems.length > 1 ? "s" : ""}`
    $("#pill-text").textContent = headline
    $("#stage-note").textContent = `${r.title}. The diff touches ${r.stats.diff.files} file${r.stats.diff.files > 1 ? "s" : ""}; the blast radius covers ${r.stats.files_in_radius}. Drag to rotate.`
    renderReport(r, i)
    if (scroll) $("#stage").scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function renderReport(r, i) {
    $("#r-eyebrow").textContent = `${SHORT[i]} · ${r.head}`
    $("#r-title").textContent = r.title
    $("#r-score").textContent = r.score.total
    const band = $("#r-band")
    band.textContent = r.score.band
    band.className = "band " + r.score.band
    const d = r.stats.diff
    $("#r-diffline").textContent = `diff ${d.files} file${d.files > 1 ? "s" : ""} +${d.insertions} −${d.deletions} · analysed in ${r.stats.analysis_ms} ms`
    $("#r-factors").innerHTML = r.score.factors.map((f) => `
      <li class="factor"><span class="fname">${esc(f.name.replace("_", " "))}</span>
        <span class="track"><i style="width:${(100 * f.points) / f.max}%"></i></span>
        <span class="pts">${f.points}/${f.max}</span>
        <span class="why">${esc(f.why)}</span></li>`).join("")

    const out = []
    for (const m of r.missed_callers) {
      out.push(`<article class="finding alert"><span class="tag">Caller left behind</span>
        <h3>${esc(m.callee.split("::")[1])} changed, but this call did not</h3>
        <p class="path">${esc(m.file)}:${m.line}</p>
        <pre>${esc(m.call)}</pre>
        <p>${esc(m.reason)}. Both arguments are strings, so TypeScript and CI stay green.</p></article>`)
    }
    for (const c of r.contract_changes) {
      out.push(`<article class="finding"><span class="tag">Signature change</span>
        <h3>${esc(c.symbol)}(${esc(c.old_params.join(", "))}) → (${esc(c.new_params.join(", "))})</h3>
        <p class="path">${esc(c.file)}:${c.line}</p>
        <p>${c.callers} callers depend on the old argument order.</p></article>`)
    }
    const adrs = [...new Map(r.docs.filter((x) => x.file.includes("adr/")).map((x) => [x.file, x])).values()]
    if (adrs.length) {
      out.push(`<article class="finding"><span class="tag neutral">ADRs in scope · Bob checks each rule</span>
        ${adrs.map((a) => `<p><b>${esc(a.title)}</b><br><span class="path">${esc(a.file)}</span></p>`).join("")}</article>`)
    }
    const subs = r.subsystems.slice(0, 14).map((s) =>
      `<span class="chip ${s.changed ? "hot" : "warm"}">${esc(s.name)}<b>${s.changed ? s.changed + " changed" : s.ripple + " affected"}</b></span>`).join("")
    out.push(`<article class="finding"><span class="tag neutral">Subsystems in the blast radius</span>
      <div class="chips">${subs}</div>
      <p class="muted small">${r.untested.length} changed or directly affected units have no test. Bob's subagents write the missing ones.</p></article>`)
    $("#r-findings").innerHTML = out.join("")
  }

  $("#results-table tbody").innerHTML = reports.map((r, i) => `
    <tr><td><span class="pr-name">${SHORT[i]} · ${esc(r.title)}</span><span class="pr-branch">${esc(r.head)}</span></td>
    <td class="n big">${r.stats.diff.files}</td><td class="n big">${r.stats.files_in_radius}</td>
    <td class="n">${parseInt(r.score.factors[0].why, 10)}</td>
    <td class="n">${r.subsystems.length}</td>
    <td class="n"><span class="band ${r.score.band}">${r.score.total}</span></td>
    <td class="n">${r.stats.analysis_ms} ms</td></tr>`).join("")

  document.querySelectorAll("[data-pr]").forEach((el) => el.addEventListener("click", (e) => {
    const i = +el.dataset.pr
    if (el.tagName === "A") e.preventDefault()
    select(i, el.tagName === "A")
  }))
  $("#replay").addEventListener("click", () => scene.restart())

  const menu = $(".menu"), mm = $(".mobile-menu")
  menu.addEventListener("click", () => { const open = mm.hidden; mm.hidden = !open; menu.setAttribute("aria-expanded", String(open)) })
  mm.addEventListener("click", () => { mm.hidden = true; menu.setAttribute("aria-expanded", "false") })

  const start = Math.max(0, SHORT.findIndex((s) => location.hash === "#" + s.toLowerCase()))
  select(start === -1 ? 2 : location.hash ? start : 2)
  window.BR = { scene, select, reports }
}

main().catch((err) => {
  console.error(err)
  const t = document.getElementById("pill-text")
  if (t) t.textContent = "Could not load the demo data. Serve this folder over http, not file://."
})
