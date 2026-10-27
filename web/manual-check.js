// Check the hand-downloaded recordings: real 16-bit WAV, sensible length, not silent.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '真人发音', '手动下载');
for (const f of fs.readdirSync(DIR).sort()) {
  const buf = fs.readFileSync(path.join(DIR, f));
  let msg;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') msg = 'NOT A WAV (' + buf.toString('utf8', 0, 40).replace(/\s+/g, ' ') + ')';
  else {
    let off = 12, fmt, sec = 0, peak = 0;
    while (off < buf.length - 8) {
      const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
      if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
      if (id === 'data' && fmt) {
        sec = size / (fmt.bits / 8) / fmt.ch / fmt.rate;
        for (let i = off + 8; i + 1 < Math.min(buf.length, off + 8 + size); i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
        break;
      }
      off += 8 + size + (size & 1);
    }
    msg = `${fmt.rate}Hz ${fmt.bits}bit ${fmt.ch}ch ${sec.toFixed(2)}s peak ${(peak / 327.67).toFixed(0)}%` + (fmt.bits !== 16 || sec < 0.3 || sec > 6 || peak < 3000 ? '  ← CHECK' : '');
  }
  console.log(f.replace(/^LL-Q5287[ _]\(jpn\)-Fukujinzuke-/, ''), msg);
}
