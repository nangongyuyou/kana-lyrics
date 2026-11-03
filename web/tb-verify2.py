# Second opinion on the textbook word clips: Whisper large-v3 transcribes each one; anything that does
# not read the same (after kana normalisation) is listed for a human ear. Kanji output is expected for
# some words (鍵 for かぎ), so the list is "check", not "wrong".
import sys, os, json, base64, tempfile, unicodedata
sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel
MD, TB = sys.argv[1:3]
m = WhisperModel(MD, device="cuda", compute_type="float16")
clips = json.load(open(TB, encoding="utf-8"))["clips"]
toH = lambda s: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in unicodedata.normalize("NFKC", s))
kana = lambda s: "".join(c for c in toH(s) if "ぁ" <= c <= "ゖ" or c == "ー")
ok, check = 0, []
f = os.path.join(tempfile.gettempdir(), "tbv.mp3")
for k, b in clips.items():
    open(f, "wb").write(base64.b64decode(b))
    segs, _ = m.transcribe(f, language="ja", beam_size=5)
    t = "".join(s.text for s in segs).strip()
    if kana(k[3:]) and kana(t) == kana(k[3:]): ok += 1
    else: check.append(f"{k[3:]}→{t}")
print("same", ok, "of", len(clips))
print("check:", " | ".join(check))
