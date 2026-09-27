"""Render the BlastRadius demo video.

1. Timeline from narration durations (build/vo/durations.json) + per-scene padding.
2. Frame-by-frame capture of video/scenes.html in Chromium (Playwright), piped to ffmpeg.
3. Audio: narration placed on the timeline, music ducked under it (sidechain), loudness -14 LUFS.

Usage: python3 video/render.py [--fps 30] [--preview]   (serve the repo root on :8766 first)
Optional: video/build/bob_footage.mp4 replaces the visuals of the scenes listed in FOOTAGE_SCENES.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).parent
BUILD = HERE / "build"
VO = BUILD / "vo"
MUSIC = HERE / "music" / "Inspired.mp3"
LEAD, TAIL = 0.55, 0.75
HOLD = {"s1": 0.8, "s3": 0.8, "s5a": 2.4, "s5b": 3.0, "s5c": 3.2, "s5d": 3.0, "s5e": 3.0, "s6": 1.0, "s7": 2.2}


def timeline() -> list[dict]:
    script = json.loads((HERE / "script.json").read_text())
    durs = json.loads((VO / "durations.json").read_text())
    t, tl = 0.0, []
    for ln in script:
        d = LEAD + durs[ln["id"]] + TAIL + HOLD.get(ln["id"], 0.4)
        tl.append({"id": ln["id"], "scene": ln["scene"], "start": round(t, 3), "end": round(t + d, 3), "vo_at": round(t + LEAD, 3)})
        t += d
    tl[-1]["last"] = True
    return tl


async def capture(tl: list[dict], fps: int, out: Path, width: int, height: int) -> None:
    total = tl[-1]["end"]
    n = int(total * fps)
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
        "-vf", f"scale={width}:{height}:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-r", str(fps), str(out),
    ], stdin=subprocess.PIPE)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-device-scale-factor=1"])
        page = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.on("pageerror", lambda e: print("pageerror:", e))
        await page.goto("http://127.0.0.1:8766/video/scenes.html", wait_until="networkidle")
        await page.wait_for_function("window.ready === true", timeout=60000)
        await page.evaluate("document.fonts.ready")
        await page.evaluate(f"window.setup({json.dumps(tl)})")
        for f in range(n):
            await page.evaluate(f"window.renderAt({f / fps})")
            jpg = await page.screenshot(type="jpeg", quality=92)
            ff.stdin.write(jpg)
            if f % (fps * 10) == 0:
                print(f"frame {f}/{n}", flush=True)
        await b.close()
    ff.stdin.close()
    ff.wait()


def make_cli_html() -> None:
    """Run the real CLI on the hero PR and convert its ANSI output to HTML lines for the CLI scene."""
    import html
    import re
    root = HERE.parent
    py = root / "blastradius" / "backend" / ".venv" / "bin" / "python"
    proc = subprocess.run([str(py), "-m", "app.cli", "review", "--repo", str(root / "demo-workspace" / "pulse"),
                           "--head", "pr-3-task-archiving", "--fail-on", "70"],
                          cwd=root / "blastradius" / "backend", capture_output=True, text=True)
    colors = {"31": "#FF8A80", "32": "#8FE3B0", "33": "#FFD27A", "38;5;208": "#FFB27A", "2": "rgba(255,255,235,.5)"}
    lines = []
    for line in proc.stdout.splitlines() + [f"exit={proc.returncode}"]:
        parts, out, depth = re.split(r"\x1b\[([0-9;]*)m", line), "", 0
        for k, part in enumerate(parts):
            if k % 2 == 0:
                out += html.escape(part)
            elif part == "0":
                out += "</span>" * depth
                depth = 0
            else:
                style = "font-weight:700" if part == "1" else f"color:{colors.get(part, 'inherit')}"
                out += f'<span style="{style}">'
                depth += 1
        lines.append(f'<span class="tline">{out}{"</span>" * depth}</span>')
    (BUILD / "cli.html").write_text("".join(lines))


def mix_audio(tl: list[dict], out: Path) -> None:
    total = tl[-1]["end"]
    inputs, filters, labels = [], [], []
    for k, s in enumerate(tl):
        inputs += ["-i", str(VO / f"{s['id']}.wav")]
        ms = int(s["vo_at"] * 1000)
        filters.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{k}]")
        labels.append(f"[v{k}]")
    m = len(tl)
    inputs += ["-i", str(MUSIC)]
    filters.append(f"{''.join(labels)}amix=inputs={m}:normalize=0,volume=1.9,apad=whole_dur={total},asplit=2[voice][key]")
    filters.append(f"[{m}:a]aresample=48000,atrim=0:{total + 1},asetpts=PTS-STARTPTS,volume=0.62,"
                   f"afade=t=in:st=0:d=1.2,afade=t=out:st={total - 3.2}:d=3.2[mus]")
    filters.append("[mus][key]sidechaincompress=threshold=0.035:ratio=5:attack=25:release=420:makeup=1[ducked]")
    filters.append(f"[ducked][voice]amix=inputs=2:normalize=0,atrim=0:{total},loudnorm=I=-14:TP=-1.2:LRA=9[out]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]",
                    "-c:a", "aac", "-b:a", "256k", str(out)], check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--preview", action="store_true", help="half resolution, 15 fps")
    ap.add_argument("--audio-only", action="store_true", help="remix audio and remux onto the existing video_only.mp4")
    args = ap.parse_args()
    BUILD.mkdir(exist_ok=True)
    tl = timeline()
    (BUILD / "timeline.json").write_text(json.dumps(tl, indent=1))
    total = tl[-1]["end"]
    demo = sum(s["end"] - s["start"] for s in tl if s["scene"] in ("pr1", "pr2", "pr3", "tests", "cli"))
    print(f"total {total:.1f}s  product demo {demo:.1f}s")
    fps = 15 if args.preview else args.fps
    w, h = (960, 540) if args.preview else (1920, 1080)
    video = BUILD / ("preview_video.mp4" if args.preview else "video_only.mp4")
    audio = BUILD / "audio.m4a"
    make_cli_html()
    mix_audio(tl, audio)
    if not args.audio_only:
        asyncio.run(capture(tl, fps, video, w, h))
    final = BUILD / ("preview.mp4" if args.preview else "blastradius_demo.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(audio), "-c:v", "copy", "-c:a", "copy",
                    "-shortest", "-movflags", "+faststart", str(final)], check=True)
    print("wrote", final)


if __name__ == "__main__":
    main()
