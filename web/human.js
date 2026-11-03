// Check which practice words / kana have native-speaker recordings on Wikimedia Commons
// (Lingua Libre uploads, "LL-Q5287 (jpn)-<speaker>-<word>.wav"). Writes human-coverage.json.
const fs = require('fs');
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const src = tpl.slice(tpl.indexOf('const BASIC'), tpl.indexOf('// ---------------- helpers'));
const K = new Function(src + '; return {BASIC, ROWS, DROWS, YBASE, DWORDS, YWORDS, EXT, SOKU, CHOU};')();

const words = new Set();
for (const b of K.BASIC) for (const w of [b[5], b[6], b[7]]) words.add(w[0]);
for (const ws of [...Object.values(K.DWORDS), ...Object.values(K.YWORDS)]) for (const w of ws) words.add(w[0]);
for (const e of K.EXT) words.add(e[2]);
for (const w of [...K.SOKU, ...K.CHOU]) words.add(w[0]);

const API = 'https://commons.wikimedia.org/w/api.php';
const H = { 'User-Agent': 'kana-study-personal/1.0 (personal study tool)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(u) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(u, { headers: H });
    const t = await r.text();
    if (t.startsWith('{')) return JSON.parse(t);
    await sleep(5000 * (i + 1)); // rate limited: back off
  }
  throw new Error('rate limited');
}
// every Japanese Lingua Libre recording, paged through the category (500 per request)
async function allTitles() {
  const titles = [];
  let cont = '';
  do {
    const u = `${API}?action=query&format=json&list=categorymembers&cmtype=file&cmlimit=500&cmtitle=${encodeURIComponent('Category:Lingua Libre pronunciation-jpn')}${cont ? '&cmcontinue=' + encodeURIComponent(cont) : ''}`;
    const r = await getJSON(u);
    titles.push(...r.query.categorymembers.map(m => m.title));
    cont = r.continue && r.continue.cmcontinue;
    await sleep(1500);
  } while (cont);
  return titles;
}

(async () => {
  const titles = await allTitles();
  fs.writeFileSync(__dirname + '/lingualibre-jpn-titles.json', JSON.stringify(titles));
  const byWord = {};
  for (const t of titles) {
    const m = t.match(/^File:LL-Q5287 \(jpn\)-(.+?)-(.+)\.\w+$/);
    if (m) (byWord[m[2]] = byWord[m[2]] || []).push(t);
  }
  const out = {};
  let hit = 0;
  for (const w of words) if (byWord[w]) { out[w] = byWord[w]; hit++; }
  console.log('Japanese recordings in category', titles.length);
  fs.writeFileSync(__dirname + '/human-coverage.json', JSON.stringify(out, null, 1));
  console.log('words', words.size, 'with recordings', hit);
  console.log('missing:', [...words].filter(w => !out[w]).join(' '));
})();
