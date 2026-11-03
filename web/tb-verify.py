# Check every cut textbook clip with Whisper large-v3: does it hear what the label says?
# Single kana are short, so Whisper is only a second opinion; mismatches are listed for a human ear.
import sys, os, json, unicodedata
sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel
model_dir, folder = sys.argv[1], sys.argv[2]
m = WhisperModel(model_dir, device="cuda", compute_type="float16")
toH = lambda s: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
same = {"ぢ": "じ", "づ": "ず", "を": "お"}
norm = lambda s: "".join(same.get(c, c) for c in toH(unicodedata.normalize("NFKC", s)) if "ぁ" <= c <= "ゖ" or c == "ー")
ok, bad = 0, []
for f in sorted(os.listdir(folder)):
    key = f[:-4]
    segs, _ = m.transcribe(os.path.join(folder, f), language="ja", beam_size=5, initial_prompt="ひらがなを一つずつ読みます。")
    text = "".join(s.text for s in segs).strip()
    if norm(key) and norm(key) in norm(text) or norm(text) == norm(key): ok += 1
    else: bad.append(f"{key}→{text}")
print("match", ok, "| check by ear:", " ".join(bad))
