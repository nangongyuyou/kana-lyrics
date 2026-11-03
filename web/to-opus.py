# Convert a folder of MP3 clips to Opus (Ogg), 24 kbps mono speech — about half the size, same clarity.
# Usage: python to-opus.py <ffmpeg> <src folder> <dst folder>
import sys, os, subprocess
from concurrent.futures import ThreadPoolExecutor
FF, SRC, DST = sys.argv[1:4]
os.makedirs(DST, exist_ok=True)
def one(f):
    dst = os.path.join(DST, f[:-4] + ".ogg")
    if os.path.exists(dst): return 0
    return subprocess.run([FF, "-v", "error", "-i", os.path.join(SRC, f), "-map", "0:a:0", "-map_metadata", "-1", "-ac", "1",
                           "-c:a", "libopus", "-b:a", "24k", "-application", "voip", "-y", dst]).returncode
files = [f for f in os.listdir(SRC) if f.endswith(".mp3")]
with ThreadPoolExecutor(8) as x: fails = sum(1 for rc in x.map(one, files) if rc)
size = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST))
print("converted", len(files), "failed", fails, "MB", round(size / 1e6, 1))
