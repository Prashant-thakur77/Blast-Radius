"""Splice real IBM Bob IDE footage (task 05 screen recording) into the PR-3 part of the demo video.

Usage: python3 video/splice_bob.py "<path to screen recording>"
Needs video/build/video_only.mp4, audio.m4a and bg_0..5.png (from video/footage/frames.html).
"""
import shutil
import subprocess
import sys
from pathlib import Path

B = Path(__file__).parent / "build"
REC = sys.argv[1]
CROP = "crop=812:1000:1062:0"  # Bob chat panel in a 1874x1020 GNOME screencast
# (caption frame, start in recording, start in video, end in video)
CLIPS = [
    (0, 46.5, 97.04, 106.94),   # gate: risk 95 + missed caller
    (1, 168.0, 106.94, 113.40),  # three subagents
    (2, 227.8, 113.40, 118.40),  # failing tests table
    (3, 220.5, 118.40, 124.00),  # findings: ADR-002
    (4, 259.0, 124.00, 128.00),  # fixes proposed + approval
    (5, 324.5, 128.00, 132.06),  # 5/5 tests green
]


def run(*a):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)


parts = []
for i, rs, vs, ve in CLIPS:
    d = round(ve - vs, 3)
    out = B / f"bobclip_{i}.mp4"
    run("-loop", "1", "-framerate", "30", "-t", str(d), "-i", str(B / f"bg_{i}.png"),
        "-ss", str(rs), "-t", str(d), "-i", REC,
        "-filter_complex", f"[1:v]fps=30,{CROP},scale=796:980,setsar=1[f];[0:v][f]overlay=1064:50:shortest=0,format=yuv420p[v]",
        "-map", "[v]", "-t", str(d), "-r", "30", "-c:v", "libx264", "-crf", "18", "-preset", "fast", str(out))
    parts.append(out)

src = B / "video_only.mp4"
first, last = CLIPS[0][2], CLIPS[-1][3]
inputs = ["-i", str(src)]
for p in parts:
    inputs += ["-i", str(p)]
n = len(parts)
fc = f"[0:v]trim=0:{first},setpts=PTS-STARTPTS[h];[0:v]trim=start={last},setpts=PTS-STARTPTS[t];"
fc += "[h]" + "".join(f"[{k + 1}:v]" for k in range(n)) + "[t]" + f"concat=n={n + 2}:v=1:a=0,format=yuv420p[v]"
run(*inputs, "-filter_complex", fc, "-map", "[v]", "-r", "30", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
    str(B / "video_with_bob.mp4"))
final = B / "blastradius_demo.mp4"
if final.exists() and not (B / "blastradius_demo_v1.mp4").exists():
    shutil.copy(final, B / "blastradius_demo_v1.mp4")
run("-i", str(B / "video_with_bob.mp4"), "-i", str(B / "audio.m4a"), "-c:v", "copy", "-c:a", "copy",
    "-shortest", "-movflags", "+faststart", str(final))
print("wrote", final)
