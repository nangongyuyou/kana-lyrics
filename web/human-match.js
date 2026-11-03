// Match Lingua Libre Japanese recordings to kana by reading (titles are often written in kanji).
// Writes ll-readings.json: [{title, word, reading}] and prints coverage of the current word list
// plus, for every kana, candidate recorded words that contain it.
const fs = require('fs');
const path = require('path');
const kuromoji = require('kuromoji');
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const src = tpl.slice(tpl.indexOf('const BASIC'), tpl.indexOf('// ---------------- helpers'));
const K = new Function(src + '; return {BASIC, ROWS, DROWS, YBASE, DWORDS, YWORDS, EXT, SOKU, CHOU};')();
const titles = JSON.parse(fs.readFileSync(__dirname + '/lingualibre-jpn-titles.json', 'utf8'));

kuromoji.builder({ dicPath: path.join(__dirname, 'node_modules/kuromoji/dict') }).build((err, tk) => {
  if (err) throw err;
  const rec = [];
  for (const t of titles) {
    const m = t.match(/^File:LL-Q5287 \(jpn\)-(.+?)-(.+)\.\w+$/);
    if (!m) continue;
    const word = m[2];
    if (!/^[ぁ-ヿ一-鿿々ー]+$/.test(word)) continue;
    const toks = tk.tokenize(word);
    if (toks.length > 2) continue; // single words only
    const reading = toHira(toks.map(x => x.reading && x.reading !== '*' ? x.reading : x.surface_form).join(''));
    const pos = toks[0].pos;
    rec.push({ title: t, speaker: m[1], word, reading, pos, freq: toks.map(x => x.word_type).join() });
  }
  fs.writeFileSync(__dirname + '/ll-readings.json', JSON.stringify(rec));
  const byKana = new Map();
  for (const r of rec) {
    const k1 = r.reading;
    if (!byKana.has(k1)) byKana.set(k1, []);
    byKana.get(k1).push(r);
  }
  // coverage of current words (kana word == reading, or katakana word == word)
  const words = new Set();
  for (const b of K.BASIC) for (const w of [b[5], b[6], b[7]]) words.add(w[0]);
  for (const ws of [...Object.values(K.DWORDS), ...Object.values(K.YWORDS)]) for (const w of ws) words.add(w[0]);
  let hit = 0;
  for (const w of words) if (byKana.has(toHira(w))) hit++;
  console.log('recordings', rec.length, 'current words covered by reading', hit, '/', words.size);
});
