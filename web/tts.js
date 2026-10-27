// Synthesize every kana, word and lyric line with a local VOICEVOX engine and write audio.json
// ({text: base64 mp3}). Usage: node tts.js [speakerId] [data.json] [needed.json]
// audio.json is a shared cache; needed.json lists the clips one build actually uses.
const fs = require('fs');
const path = require('path');
let Mp3Encoder; // ESM-only package, loaded in main()
const API = 'http://127.0.0.1:50021';
const SPEAKER = +(process.argv[2] || 14);
const DATA = path.resolve(__dirname, process.argv[3] || 'data.json');
const NEEDED = path.resolve(__dirname, process.argv[4] || 'needed.json');

// pull the knowledge tables out of the template so words stay in sync
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const src = tpl.slice(tpl.indexOf('const BASIC'), tpl.indexOf('// ---------------- helpers'));
const K = new Function(src + '; return {BASIC, ROWS, DROWS, YBASE, DWORDS, YWORDS, EXT, SOKU, CHOU, MINI};')();
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

const items = new Map(); // key -> {text, kind}
const units = [...K.ROWS.flat(), ...K.DROWS.flat()].filter(Boolean);
for (const b of K.YBASE) for (const s of 'ゃゅょ') units.push(b + s);
for (const u of units) items.set(u, { text: toKata(u), kind: 'unit' });
for (const b of K.BASIC) for (const w of [b[5], b[6], b[7]]) items.set(w[0], { text: w[0], kind: 'word' });
for (const ws of [...Object.values(K.DWORDS), ...Object.values(K.YWORDS)]) for (const w of ws) items.set(w[0], { text: w[0], kind: 'word' });
for (const e of K.EXT) { items.set(e[0], { text: e[0], kind: 'unit' }); items.set(e[2], { text: e[2], kind: 'word' }); }
for (const w of [...K.SOKU, ...K.CHOU]) items.set(w[0], { text: w[0], kind: 'word' });
for (const m of K.MINI) for (const w of [m[0], m[1]]) items.set(w[0], { text: w[0], kind: 'word' });
for (const list of Object.values(data.ex)) for (const ex of list) {
  // keyed by the written line; hand-given readings (f) are spoken from their kana
  const t = ex.t.map(x => x.s).join('');
  if (!items.has(t)) items.set(t, { text: ex.t.map(x => x.f ? x.r : x.s).join(''), kind: 'line' });
}

function pcmFromWav(buf) {
  let off = 12;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'data') return new Int16Array(buf.buffer.slice(buf.byteOffset + off + 8, buf.byteOffset + off + 8 + size));
    off += 8 + size;
  }
  throw new Error('no data chunk');
}
function toMp3(pcm, rate, kbps) {
  const enc = new Mp3Encoder(1, rate, kbps), out = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(Buffer.from(b)); }
  const e = enc.flush(); if (e.length) out.push(Buffer.from(e));
  return Buffer.concat(out);
}

(async () => {
  const lame = await import('@breezystack/lamejs');
  Mp3Encoder = lame.Mp3Encoder || (lame.default && lame.default.Mp3Encoder);
  const out =fs.existsSync(__dirname + '/audio.json') ? JSON.parse(fs.readFileSync(__dirname + '/audio.json', 'utf8')) : {};
  const readings = {};
  let n = 0;
  for (const [key, it] of items) {
    n++;
    if (out[key]) continue;
    const q = await (await fetch(`${API}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(it.text)}`, { method: 'POST' })).json();
    q.outputSamplingRate = 24000; q.outputStereo = false;
    q.speedScale = it.kind === 'line' ? 0.95 : 0.85;
    q.prePhonemeLength = 0.05; q.postPhonemeLength = 0.1;
    if (it.kind === 'unit') readings[key] = q.kana;
    const wav = Buffer.from(await (await fetch(`${API}/synthesis?speaker=${SPEAKER}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })).arrayBuffer());
    // 48 kbps for everything: at 32 kbps the encoder silently resamples to 22050 Hz,
    // and those files would not play on some phones/PCs
    out[key] = toMp3(pcmFromWav(wav), 24000, 48).toString('base64');
    if (n % 50 === 0) { console.log(n + '/' + items.size); fs.writeFileSync(__dirname + '/audio.json', JSON.stringify(out)); }
  }
  fs.writeFileSync(__dirname + '/audio.json', JSON.stringify(out));
  fs.writeFileSync(NEEDED, JSON.stringify([...items.keys()]));
  fs.writeFileSync(__dirname + '/unit-readings.json', JSON.stringify(readings, null, 0));
  const kb = Math.round(Object.values(out).reduce((a, b) => a + b.length, 0) / 1024);
  console.log('done', items.size, 'clips, base64 KB', kb);
})().catch(e => { console.error(e); process.exit(1); });
