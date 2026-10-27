// Download Fukujinzuke's recordings for the matched words, trim silence and encode them exactly like
// the VOICEVOX clips that are known to play everywhere (mono, 24 kHz, 48 kbps MP3). Writes human.json.
// Recordings: Fukujinzuke via Lingua Libre / Wikimedia Commons, CC BY 4.0.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '真人发音', 'Fukujinzuke');
const H = { 'User-Agent': 'kana-study-personal/1.0 (personal study tool)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cand = JSON.parse(fs.readFileSync(__dirname + '/fuku-candidates.json', 'utf8'));
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const src = tpl.slice(tpl.indexOf('const BASIC'), tpl.indexOf('// ---------------- helpers'));
const K = new Function(src + '; return {MINI};')();

// reading-only matches checked by hand; けん → 県 (prefecture) is not 剑, so it is left out
const REJECT = new Set(['けん']);
const PREFER = { 'くも': '雲' };
const map = { ...cand.exact };
for (const [w, v] of Object.entries(cand.byReading)) {
  if (REJECT.has(w)) continue;
  const o = v.options.find(x => x[0] === PREFER[w]) || v.options[0];
  map[w] = o[1];
}
// a listening pair must use one voice for both words, or the voice itself gives the answer away
for (const m of K.MINI) { const a = m[0][0], b = m[1][0]; if (!(map[a] && map[b])) { delete map[a]; delete map[b]; } }
// single kana too (appended last so earlier downloads keep their file numbers); the page keys
// each sound by its hiragana, so a katakana-only recording is used for its hiragana key as well
{
  const all = JSON.parse(fs.readFileSync(__dirname + '/ll-readings.json', 'utf8')).filter(r => r.speaker === 'Fukujinzuke');
  const toH = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ';
  for (const k of kana) {
    if (map[k]) continue;
    const rec = all.find(r => r.word === k) || all.find(r => toH(r.word) === k);
    if (rec) map[k] = rec.title;
  }
}

function pcm(buf) {
  let off = 12, fmt = null;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error('unsupported wav');
      const n = size / 2 / fmt.ch, out = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += buf.readInt16LE(off + 8 + (i * fmt.ch + c) * 2); out[i] = s / fmt.ch; }
      return { data: out, rate: fmt.rate };
    }
    off += 8 + size + (size & 1);
  }
  throw new Error('no data');
}
function prepare({ data, rate }) {
  // trim leading/trailing silence, keep a little air
  let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v));
  const th = peak * 0.04, pad = Math.round(rate * 0.06);
  let a = 0, b = data.length - 1;
  while (a < b && Math.abs(data[a]) < th) a++;
  while (b > a && Math.abs(data[b]) < th) b--;
  const cut = data.subarray(Math.max(0, a - pad), Math.min(data.length, b + pad));
  // resample to 24 kHz (box filter), normalize to ~90% peak
  const ratio = rate / 24000, n = Math.floor(cut.length / ratio), out = new Int16Array(n), gain = 0.9 * 32767 / (peak || 1);
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i * ratio), e = Math.max(s + 1, Math.floor((i + 1) * ratio));
    let sum = 0; for (let j = s; j < e; j++) sum += cut[j];
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sum / (e - s) * gain)));
  }
  return out;
}

// direct upload.wikimedia.org URLs, looked up 40 titles per API call (much less throttled than Special:FilePath)
async function directUrls(titles) {
  const urls = {};
  for (let i = 0; i < titles.length; i += 40) {
    const part = titles.slice(i, i + 40);
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=' + encodeURIComponent(part.join('|'));
    for (let k = 0; k < 6; k++) {
      const t = await (await fetch(u, { headers: H, signal: AbortSignal.timeout(20000) })).text();
      if (t.startsWith('{')) {
        const j = JSON.parse(t);
        const norm = {}; (j.query.normalized || []).forEach(n => norm[n.to] = n.from);
        for (const p of Object.values(j.query.pages)) if (p.imageinfo) urls[norm[p.title] || p.title] = p.imageinfo[0].url;
        break;
      }
      await sleep(5000 * (k + 1));
    }
    await sleep(1000);
  }
  return urls;
}

(async () => {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  fs.mkdirSync(DIR, { recursive: true });
  const direct = await directUrls([...new Set(Object.values(map))]);
  console.log('direct urls', Object.keys(direct).length);
  const outPath = __dirname + '/human.json';
  const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  const words = Object.keys(map);
  let i = 0, fail = [];
  // single kana first (heard most often), then words; file numbers stay tied to the original order.
  // Words that already have a Kanji alive recording are skipped entirely.
  const kaPath = __dirname + '/ka.json';
  const ka = fs.existsSync(kaPath) ? JSON.parse(fs.readFileSync(kaPath, 'utf8')) : {};
  const order = [...words.filter(w => [...w].length === 1 && !ka[w]), ...words.filter(w => [...w].length !== 1 && !ka[w])];
  const MANUAL = path.join(DIR, '..', '手动下载');
  const norm = s => s.replace(/^File:/, '').replace(/_/g, ' ').normalize('NFC');
  const manual = {};
  if (fs.existsSync(MANUAL)) for (const f of fs.readdirSync(MANUAL)) if (/\.wav$/i.test(f)) manual[norm(f)] = f;
  console.log('to fetch', order.filter(w => !out[w]).length, '| saved by hand', Object.keys(manual).length);
  for (const w of order) {
    i = words.indexOf(w) + 1;
    if (out[w]) continue;
    const file = path.join(DIR, `${String(i).padStart(3, '0')}.wav`);
    try {
      // a copy saved by hand from 手动下载清单.html (original file name) is used as is
      const own = manual[norm(map[w])];
      if (!fs.existsSync(file) && own) fs.copyFileSync(path.join(MANUAL, own), file);
      if (!fs.existsSync(file)) {
        const url = direct[map[w]] || 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(map[w].replace(/^File:/, ''));
        let ok = false;
        for (let k = 0; k < 8 && !ok; k++) {
          const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
          if (r.ok && /audio|octet|wav/.test(r.headers.get('content-type') || '')) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); ok = true; }
          else await sleep(r.status === 429 ? 60000 : 5000); // 429: fixed one-minute cool-down instead of ever longer waits
        }
        if (!ok) throw new Error('download failed');
        await sleep(12000); // ~5 files a minute stays under Wikimedia's burst limit
      }
      const s16 = prepare(pcm(fs.readFileSync(file)));
      const enc = new Mp3Encoder(1, 24000, 48), parts = [];
      for (let j = 0; j < s16.length; j += 1152) { const b = enc.encodeBuffer(s16.subarray(j, j + 1152)); if (b.length) parts.push(Buffer.from(b)); }
      const f = enc.flush(); if (f.length) parts.push(Buffer.from(f));
      out[w] = Buffer.concat(parts).toString('base64');
      // save often so a build in between can already use what has arrived
      if (Object.keys(out).length % 3 === 0) { fs.writeFileSync(outPath, JSON.stringify(out)); console.log(Object.keys(out).length + '/' + words.length); }
    } catch (e) { fail.push(w + ':' + e.message); }
  }
  fs.writeFileSync(outPath, JSON.stringify(out));
  fs.writeFileSync(__dirname + '/human-map.json', JSON.stringify(map, null, 1));
  console.log('done', Object.keys(out).length, '/', words.length, 'failed', fail.join(' '));
})();
