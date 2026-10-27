// Fetch KanjiVG stroke-order SVGs for every kana and keep only the stroke paths.
// Writes strokes.json: {char: [pathD, ...]} (KanjiVG, CC BY-SA 3.0, Ulrich Apel).
const fs = require('fs');
const BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';
const chars = [];
for (let c = 0x3041; c <= 0x3093; c++) chars.push(c);
for (let c = 0x30A1; c <= 0x30F3; c++) chars.push(c);
chars.push(0x30F4, 0x30FC);

(async () => {
  const out = {}, missing = [];
  for (let i = 0; i < chars.length; i += 8) {
    await Promise.all(chars.slice(i, i + 8).map(async cp => {
      const ch = String.fromCodePoint(cp);
      const r = await fetch(BASE + cp.toString(16).padStart(5, '0') + '.svg');
      if (!r.ok) { missing.push(ch); return; }
      const svg = await r.text();
      // stroke paths carry ids like kvg:03042-s1; take d attributes in document order
      const ds = [...svg.matchAll(/<path[^>]*id="kvg:[0-9a-f]+-s\d+"[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
      if (ds.length && ds.every(d => /^[MmCcSsLlZz0-9.,\s-]+$/.test(d))) out[ch] = ds; else missing.push(ch);
    }));
  }
  fs.writeFileSync(__dirname + '/strokes.json', JSON.stringify(out));
  console.log('got', Object.keys(out).length, 'missing', missing.join(''));
})();
