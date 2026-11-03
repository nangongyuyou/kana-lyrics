# Extract the 新标准日本语 vocabulary (初级 / 中级 / 高级) from the Anki decks:
# writes vocab.json and converts every recording to 24 kHz mono MP3 (22050 Hz files do not play on some phones).
# Usage: python anki-vocab.py <deck folder> <out folder> <ffmpeg.exe>
import sys, os, re, json, zipfile, sqlite3, tempfile, subprocess
from concurrent.futures import ThreadPoolExecutor
sys.stdout.reconfigure(encoding="utf-8")
SRC, OUT, FFMPEG = sys.argv[1:4]
DECKS = [("1", "初级 (假名到释义).apkg"), ("2", "中级 (假名到释义).apkg"), ("3", "高级 (释义到日文).apkg")]
os.makedirs(os.path.join(OUT, "w"), exist_ok=True)

def parse(jp):
    """Anki furigana '韓国[かんこく] 人[じん]' -> tokens [{s, r?}] and the full reading."""
    toks = []
    for part in jp.split(" "):
        m = re.fullmatch(r"(.*?)([^\x00-\x7f]*?)\[([^\]]+)\](.*)", part)
        if not m:
            if part: toks.append({"s": part})
            continue
        pre, base, reading, post = m.groups()
        # Anki furigana: the bracket reads everything since the previous space (売り上[うりあ]げる → 売り上 = うりあ)
        run = pre + base
        if re.search(r"[一-鿿々〆ヶ]", run): toks.append({"s": run, "r": reading})
        elif run or reading: toks.append({"s": run or reading})
        if post: toks.append({"s": post})
    return toks

words, jobs = [], []
for book, deck in DECKS:
    z = zipfile.ZipFile(os.path.join(SRC, deck))
    media = json.loads(z.read("media"))
    by_name = {v: k for k, v in media.items()}
    tmp = os.path.join(tempfile.mkdtemp(), "c.db"); open(tmp, "wb").write(z.read("collection.anki2"))
    for (flds,) in sqlite3.connect(tmp).execute("select flds from notes order by sfld"):
        f = flds.split("\x1f")
        order, jp, pos, mean, lesson, snd = (f + [""] * 6)[:6]
        toks = parse(jp)
        sm = re.search(r"\[sound:([^\]]+)\]", snd)
        wid = f"{book}-{int(lesson):02d}-{len([w for w in words if w['b'] == book and w['l'] == int(lesson)]):02d}"
        w = {"id": wid, "b": book, "l": int(lesson), "t": toks, "r": "".join(t.get("r", t["s"]) for t in toks),
             "p": pos.strip("[]"), "m": re.sub(r"<[^>]+>", "", mean).strip()}
        if sm and sm.group(1) in by_name:
            w["a"] = 1
            jobs.append((z, by_name[sm.group(1)], os.path.join(OUT, "w", wid + ".mp3")))
        words.append(w)

def convert(job):
    z, member, dst = job
    if os.path.exists(dst): return 0
    p = subprocess.run([FFMPEG, "-v", "error", "-i", "pipe:0", "-ac", "1", "-ar", "24000", "-b:a", "40k", "-y", dst],
                       input=z.read(member), capture_output=True)
    return p.returncode

# zipfile objects are not thread-safe for reads: read bytes first per job in the worker under a lock
import threading
lock = threading.Lock()
def safe(job):
    z, member, dst = job
    if os.path.exists(dst): return 0
    with lock: data = z.read(member)
    # audio stream only: the decks carry tags/cover art that would triple the size of these short clips
    p = subprocess.run([FFMPEG, "-v", "error", "-i", "pipe:0", "-map", "0:a:0", "-map_metadata", "-1", "-id3v2_version", "0",
                        "-ac", "1", "-ar", "24000", "-b:a", "40k", "-y", dst], input=data, capture_output=True)
    return p.returncode
with ThreadPoolExecutor(8) as ex:
    fails = sum(1 for rc in ex.map(safe, jobs) if rc)
json.dump(words, open(os.path.join(OUT, "vocab.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
size = sum(os.path.getsize(os.path.join(OUT, "w", n)) for n in os.listdir(os.path.join(OUT, "w")))
print("words", len(words), "audio", len(jobs), "failed", fails, "MB", round(size / 1e6, 1))
for w in words[:3] + words[2150:2152]: print(w)
