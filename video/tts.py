"""Generate narration with Chatterbox TTS. Writes build/vo/<id>.wav and build/vo/durations.json."""
import json, sys, time
from pathlib import Path
import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS

HERE = Path(__file__).parent
OUT = HERE / "build" / "vo"
OUT.mkdir(parents=True, exist_ok=True)
lines = json.loads((HERE / "script.json").read_text())
only = set(sys.argv[1:])
ref = HERE / "voice_ref.wav"
model = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
durs_path = OUT / "durations.json"
durs = json.loads(durs_path.read_text()) if durs_path.exists() else {}
for ln in lines:
    if only and ln["id"] not in only:
        continue
    t = time.time()
    kw = dict(exaggeration=0.45, cfg_weight=0.5, temperature=0.7)
    if ref.exists():
        kw["audio_prompt_path"] = str(ref)
    torch.manual_seed(1234)
    # split into sentences so long lines stay stable, then join with short gaps
    import re
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", ln["text"]) if p.strip()]
    chunks = []
    for p in parts:
        w = model.generate(p, **kw)
        chunks.append(w)
        chunks.append(torch.zeros(1, int(model.sr * 0.22)))
    wav = torch.cat(chunks[:-1], dim=1)
    ta.save(str(OUT / f"{ln['id']}.wav"), wav, model.sr)
    durs[ln["id"]] = round(wav.shape[-1] / model.sr, 3)
    print(ln["id"], durs[ln["id"]], "s  gen", round(time.time() - t, 1), flush=True)
    durs_path.write_text(json.dumps(durs, indent=1))
print("total", round(sum(durs.values()), 1))
