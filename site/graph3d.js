// BlastRadius 3D blast view. Shared by the site (index.html) and the video scenes (scene.html).
import * as THREE from "./vendor/three.module.min.js"

const C = {
  base: new THREE.Color("#5E5D57"),
  faded: new THREE.Color("#C9C7B0"),
  changed: new THREE.Color("#D80027"),
  d1: new THREE.Color("#FF6C4C"),
  d2: new THREE.Color("#FFA946"),
  d3: new THREE.Color("#F5A3E4"),
  missed: new THREE.Color("#D80027"),
  edge: new THREE.Color("#9C9A86"),
  edgeFaded: new THREE.Color("#E2E0C8"),
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function createGraphScene({ canvas, labels, graph, theme = "light", autoRotate = true }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500)
  camera.position.set(0, 3, 40)
  const world = new THREE.Group()
  scene.add(world)
  scene.add(new THREE.AmbientLight(0xffffff, 1.6))
  const dir = new THREE.DirectionalLight(0xffffff, 1.4)
  dir.position.set(10, 20, 15)
  scene.add(dir)

  if (theme === "dark") {
    C.base.set("#9FB8B2"); C.faded.set("#2E6A61"); C.edge.set("#4E8A80"); C.edgeFaded.set("#1D5E55")
  }

  const units = graph.units
  const n = units.length
  const idxByQ = new Map(units.map((u, i) => [u.q, i]))

  // nodes
  const geo = new THREE.SphereGeometry(1, 18, 14)
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const mesh = new THREE.InstancedMesh(geo, mat, n)
  const m4 = new THREE.Matrix4()
  const baseScale = units.map((u) => 0.26 + 0.07 * Math.sqrt(u.c))
  const pos = units.map((u) => new THREE.Vector3(...u.p))
  for (let i = 0; i < n; i++) {
    m4.makeScale(baseScale[i], baseScale[i], baseScale[i]).setPosition(pos[i])
    mesh.setMatrixAt(i, m4)
    mesh.setColorAt(i, C.base)
  }
  world.add(mesh)

  // edges
  const E = graph.edges
  const epos = new Float32Array(E.length * 6)
  const ecol = new Float32Array(E.length * 6)
  E.forEach(([a, b], k) => {
    epos.set([pos[a].x, pos[a].y, pos[a].z, pos[b].x, pos[b].y, pos[b].z], k * 6)
  })
  const egeo = new THREE.BufferGeometry()
  egeo.setAttribute("position", new THREE.BufferAttribute(epos, 3))
  egeo.setAttribute("color", new THREE.BufferAttribute(ecol, 3))
  const lines = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }))
  world.add(lines)

  // shock rings (billboards)
  const rings = []
  for (let r = 0; r < 3; r++) {
    const rm = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 96),
      new THREE.MeshBasicMaterial({ color: "#FF6C4C", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    )
    scene.add(rm)
    rings.push(rm)
  }
  // missed-caller halo
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 64),
    new THREE.MeshBasicMaterial({ color: "#D80027", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  )
  scene.add(halo)

  let state = { changed: new Set(), dist: new Map(), missed: new Set(), keyLabels: [], active: false }
  let t0 = performance.now()
  let clock = null // when set, render uses this time (seconds) instead of wall time
  let rotY = 0.6, rotX = 0.18, dragging = false, lastX = 0, lastY = 0, userRot = 0

  function setReport(report, labelsSpec = []) {
    const changed = new Set()
    for (const c of report.changed_units) { const i = idxByQ.get(c.qualname); if (i !== undefined) changed.add(i) }
    const dist = new Map()
    for (const r of report.ripple) { const i = idxByQ.get(r.qualname); if (i !== undefined) dist.set(i, r.distance) }
    const missed = new Set()
    for (const m of report.missed_callers) { const i = idxByQ.get(m.caller); if (i !== undefined) missed.add(i) }
    const keyLabels = labelsSpec
      .map((l) => ({ ...l, i: idxByQ.get(l.q) }))
      .filter((l) => l.i !== undefined)
    state = { changed, dist, missed, keyLabels, active: true }
    let cx = new THREE.Vector3(), k = 0
    for (const i of changed) { cx.add(pos[i]); k++ }
    state.center = k ? cx.multiplyScalar(1 / k) : new THREE.Vector3()
    restart()
  }

  function clear() { state = { changed: new Set(), dist: new Map(), missed: new Set(), keyLabels: [], active: false }; restart() }
  function restart() { t0 = performance.now() }

  const tmp = new THREE.Color()
  function nodeColor(i, t) {
    if (!state.active) return C.base
    const fade = smooth((t - 0.1) / 0.6)
    if (state.changed.has(i)) {
      const a = smooth((t - 0.25) / 0.35)
      return tmp.copy(C.base).lerp(C.changed, a)
    }
    if (state.missed.has(i)) {
      const a = smooth((t - 1.1) / 0.3)
      return tmp.copy(C.faded).lerp(C.missed, a)
    }
    const d = state.dist.get(i)
    if (d !== undefined) {
      const a = smooth((t - (0.55 + 0.5 * (d - 1))) / 0.35)
      const target = d === 1 ? C.d1 : d === 2 ? C.d2 : C.d3
      return tmp.copy(C.faded).lerp(target, a)
    }
    return tmp.copy(C.base).lerp(C.faded, fade)
  }

  function paint(t) {
    for (let i = 0; i < n; i++) {
      const involved = state.changed.has(i) || state.dist.has(i) || state.missed.has(i)
      let s = baseScale[i]
      if (state.active && involved) {
        const pop = state.changed.has(i) ? smooth((t - 0.25) / 0.3) : smooth((t - 0.6 - 0.5 * ((state.dist.get(i) || 1) - 1)) / 0.3)
        s = s * (1 + 0.55 * pop)
      }
      if (state.missed.has(i)) s *= 1 + 0.25 * Math.max(0, Math.sin(t * 4))
      m4.makeScale(s, s, s).setPosition(pos[i])
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, nodeColor(i, t))
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
    E.forEach(([a, b], k) => {
      let col = state.active ? C.edgeFaded : C.edge
      if (state.active) {
        const ia = state.changed.has(a) || state.dist.has(a) || state.missed.has(a)
        const ib = state.changed.has(b) || state.dist.has(b) || state.missed.has(b)
        if (ia && ib) col = nodeColor(a, t).clone().lerp(nodeColor(b, t), 0.5)
      }
      ecol.set([col.r, col.g, col.b, col.r, col.g, col.b], k * 6)
    })
    egeo.attributes.color.needsUpdate = true
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.z = w / h < 0.9 ? 58 : 40
    camera.updateProjectionMatrix()
  }

  const v = new THREE.Vector3()
  function renderAt(t, rotation) {
    resize()
    world.rotation.y = rotation
    world.rotation.x = rotX
    paint(t)
    // rings expand from the changed centroid
    if (state.active && state.center) {
      const c = v.copy(state.center).applyMatrix4(world.matrixWorld)
      rings.forEach((r, k) => {
        const p = (t - 0.3 - k * 0.45) / 2.2
        const on = p > 0 && p < 1
        r.position.copy(c)
        r.quaternion.copy(camera.quaternion)
        const s = 1 + p * 26
        r.scale.set(s, s, s)
        r.material.opacity = on ? 0.55 * (1 - p) : 0
      })
    } else rings.forEach((r) => (r.material.opacity = 0))
    // halo on missed caller
    if (state.missed.size) {
      const i = [...state.missed][0]
      halo.position.copy(v.copy(pos[i]).applyMatrix4(world.matrixWorld))
      halo.quaternion.copy(camera.quaternion)
      const s = 1.3 + 0.35 * Math.sin(t * 4)
      halo.scale.set(s, s, s)
      halo.material.opacity = smooth((t - 1.2) / 0.4) * 0.95
    } else halo.material.opacity = 0
    world.updateMatrixWorld()
    renderer.render(scene, camera)
    // labels
    if (labels) {
      const w = canvas.clientWidth, h = canvas.clientHeight
      labels.innerHTML = ""
      for (const l of state.keyLabels) {
        const at = l.at ?? 1.0
        if (t < at) continue
        const p = v.copy(pos[l.i]).applyMatrix4(world.matrixWorld).project(camera)
        if (p.z > 1) continue
        const el = document.createElement("div")
        el.className = "lbl" + (l.red ? " red" : "")
        el.innerHTML = l.html
        const half = Math.min(150, w * 0.4)
        el.style.left = `${Math.max(half, Math.min(w - half, ((p.x + 1) / 2) * w))}px`
        el.style.top = `${((1 - p.y) / 2) * h}px`
        el.style.opacity = String(smooth((t - at) / 0.3))
        labels.appendChild(el)
      }
    }
  }

  function frame() {
    const t = clock ?? (performance.now() - t0) / 1000
    if (autoRotate && !dragging) rotY += 0.0016
    renderAt(t, rotY + userRot)
    if (clock === null) requestAnimationFrame(frame)
  }

  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return
    userRot += (e.clientX - lastX) * 0.006
    rotX = Math.max(-0.8, Math.min(0.8, rotX + (e.clientY - lastY) * 0.004))
    lastX = e.clientX; lastY = e.clientY
  })
  canvas.addEventListener("pointerup", () => { dragging = false })
  window.addEventListener("resize", resize)

  return {
    setReport, clear, restart, start: () => requestAnimationFrame(frame),
    // deterministic capture: freeze the clock and render one frame
    capture(t, rotation) { clock = t; renderAt(t, rotation) },
    setCamera(z, y = 3) { camera.position.set(0, y, z); camera.updateProjectionMatrix() },
  }
}
