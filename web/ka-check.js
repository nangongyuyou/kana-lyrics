// How many of our practice words have a Kanji alive recording? (CC BY 4.0, https://kanjialive.com)
// Downloads only the language-data CSV from GitHub and compares readings.
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

(async () => {
  const base = 'https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/';
  let csv = null;
  for (const name of ['ka_data.csv', 'ka_data_v3.csv']) {
    const r = await fetch(base + name, { signal: AbortSignal.timeout(30000) });
    if (r.ok) { csv = await r.text(); console.log('got', name, Math.round(csv.length / 1024), 'KB'); break; }
  }
  if (!csv) return console.log('csv not found');
  fs.writeFileSync(__dirname + '/ka_data.csv', csv);
  // the examples column holds entries like 学校（がっこう）[school]; collect every kana reading
  const re = /([^\s"'、，,\[\]（）()]+)（([ぁ-ゖァ-ヺー]+)）/g;
  const byReading = {};
  for (const m of csv.matchAll(re)) (byReading[toHira(m[2])] = byReading[toHira(m[2])] || new Set()).add(m[1]);
  let hit = 0; const hits = [];
  for (const [w, mean] of words) { const s = byReading[toHira(w)]; if (s) { hit++; hits.push(`${w}=${[...s].join('/')}(${mean})`); } }
  console.log('our words', words.size, 'with Kanji alive recording', hit);
  console.log(hits.join('  '));
})();
