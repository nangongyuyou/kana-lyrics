# Transcribe each speech segment of a textbook track separately (to label tracks whose layout is unclear).
# Usage: python tb-segtext.py <model dir> <ffmpeg> <track folder> <segments.json> track...
import sys, os, json, subprocess, tempfile
sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel
MD, FF, DIR, SEGS = sys.argv[1:5]
m = WhisperModel(MD, device="cuda", compute_type="float16")
segs = json.load(open(SEGS, encoding="utf-8"))
tmp = tempfile.mkdtemp()
for t in sys.argv[5:]:
    out = []
    for i, (a, b) in enumerate(segs[t]):
        f = os.path.join(tmp, f"{i}.wav")
        subprocess.run([FF, "-v", "error", "-ss", str(max(0, a - 0.1)), "-to", str(b + 0.15), "-i", os.path.join(DIR, t + ".mp3"), "-ar", "16000", "-ac", "1", "-y", f], check=True)
        r, _ = m.transcribe(f, language="ja", beam_size=5)
        out.append(f"{i}:{''.join(x.text for x in r).strip()}")
    print(t, " | ".join(out))
