# Speech segments of textbook tracks (ffmpeg silencedetect), to label and cut single kana / words.
# Usage: python tb-segments.py <ffmpeg> <track folder> <out.json> <noise dB> <min silence s> track...
import sys, re, json, subprocess
sys.stdout.reconfigure(encoding="utf-8")
FF, DIR, OUT, NOISE, DUR = sys.argv[1:6]
res = {}
for name in sys.argv[6:]:
    p = subprocess.run([FF, "-hide_banner", "-i", f"{DIR}\\{name}.mp3", "-af", f"silencedetect=noise={NOISE}dB:d={DUR}", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="ignore")
    log = p.stderr
    total = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", log).group(3)) + 60 * int(re.search(r"Duration: (\d+):(\d+)", log).group(2))
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    segs, t = [], 0.0
    for s, e in zip(starts, ends + [total]):
        if s - t > 0.08: segs.append([round(t, 2), round(s, 2)])
        t = e
    if total - t > 0.08: segs.append([round(t, 2), round(total, 2)])
    res[name] = segs
    print(name, len(segs), " ".join(f"{a:.1f}-{b:.1f}" for a, b in segs))
json.dump(res, open(OUT, "w", encoding="utf-8"), indent=1)
