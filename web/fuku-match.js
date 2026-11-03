// Match our practice words to Fukujinzuke's Lingua Libre recordings.
// Exact kana/katakana matches are taken as-is; kanji-titled recordings that only match by reading
// are listed separately so the meaning can be checked by hand. Writes fuku-candidates.json.
const fs = require('fs');
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const src = tpl.slice(tpl.indexOf('const BASIC'), tpl.indexOf('// ---------------- helpers'));
const K = new Function(src + '; return {BASIC, DWORDS, YWORDS, EXT, SOKU, CHOU, MINI};')();
const words = new Map();
for (const b of K.BASIC) for (const w of [b[5], b[6], b[7]]) words.set(w[0], w[1]);
for (const ws of [...Object.values(K.DWORDS), ...Object.values(K.YWORDS)]) for (const w of ws) words.set(w[0], w[1]);
for (const e of K.EXT) words.set(e[2], e[3]);
for (const w of [...K.SOKU, ...K.CHOU]) words.set(w[0], w[1]);
for (const m of K.MINI) for (const w of [m[0], m[1]]) words.set(w[0], w[1]);

const rec = JSON.parse(fs.readFileSync(__dirname + '/ll-readings.json', 'utf8')).filter(r => r.speaker === 'Fukujinzuke');
const exact = {}, byReading = {};
for (const [w, meaning] of words) {
  const e = rec.find(r => r.word === w || toHira(r.word) === toHira(w));
  if (e) { exact[w] = e.title; continue; }
  const rd = rec.filter(r => r.reading === toHira(w) && /[一-鿿]/.test(r.word));
  if (rd.length) byReading[w] = { meaning, options: rd.map(r => [r.word, r.title]) };
}
fs.writeFileSync(__dirname + '/fuku-candidates.json', JSON.stringify({ exact, byReading }, null, 1));
console.log('words', words.size, 'exact', Object.keys(exact).length, 'reading-only', Object.keys(byReading).length);
for (const [w, v] of Object.entries(byReading)) console.log(w, v.meaning, '=>', v.options.map(o => o[0]).join(' / '));
