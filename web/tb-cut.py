# Cut single kana and contrast words out of the textbook recordings (《一人で学べるひらがなカタカナ》).
# Segments come from tb-segments.py; each track's labels follow the textbook's fixed reading order
# ("_" = announcement such as "2-3", skipped). Writes <out>/<key>.mp3 (24 kHz mono) and tb.json {key: base64}.
# Usage: python tb-cut.py <ffmpeg> <track folder> <segments.json> <out folder>
import sys, os, json, base64, subprocess
sys.stdout.reconfigure(encoding="utf-8")
FF, DIR, SEGS, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
segs = json.load(open(SEGS, encoding="utf-8"))

def merge(s, gap):
    """join pieces split by a short pause inside one word (っ makes a silent beat: か|っこ)"""
    out = []
    for a, b in s:
        if out and a - out[-1][1] < gap: out[-1][1] = b
        else: out.append([a, b])
    return out

H = list("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん")
yoon = lambda bases: [b + s for b in bases for s in "ゃゅょ"]
LABELS = {
    "002_hatsuon": ["_"] + H,
    "008_2-3": ["_"] + list("がぎぐげご"),
    "015_3-3": ["_"] + list("ざじずぜぞ") + ["_"] * 17,
    "018_4-3": ["_"] + list("だぢづでど"),
    "026_6-3": ["_"] + list("ばびぶべぼ"),
    "028_6-5": ["_"] + list("ぱぴぷぺぽ"),
    "052_11-2": ["_", "_"] + yoon("きしちにひ") + ["_"] + yoon("みり") + ["_"] + yoon("ぎじ") + ["_"] + yoon("びぴ"),
    "044_9-1": ["_"] * 3 + "おばさん おばあさん おじさん おじいさん ゆき ゆうき え ええ へや へいや ここ こうこう とる とおる".split(),
    "048_10-1": ["_"] * 3 + "かこ かっこ いさい いっさい おと おっと いち いっち".split(),
}
MERGE = {"048_10-1": 0.6}
out, problems = {}, []
for track, labels in LABELS.items():
    s = merge(segs[track], MERGE.get(track, 0.12))
    if len(s) != len(labels):
        problems.append(f"{track}: {len(s)} segments, {len(labels)} labels"); continue
    for (a, b), key in zip(s, labels):
        if key == "_": continue
        dst = os.path.join(OUT, key + ".mp3")
        # a little air on both sides; even out the loudness between tracks
        subprocess.run([FF, "-v", "error", "-ss", f"{max(0, a - 0.06):.2f}", "-to", f"{b + 0.12:.2f}", "-i", os.path.join(DIR, track + ".mp3"),
                        "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000", "-b:a", "48k", "-y", dst], check=True)
        out[key] = base64.b64encode(open(dst, "rb").read()).decode()
json.dump(out, open(os.path.join(OUT, "..", "tb.json"), "w", encoding="utf-8"))
print("clips", len(out), "| problems:", problems or "none")
