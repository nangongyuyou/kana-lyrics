// A page of download links for the Fukujinzuke recordings that have not arrived yet, so they can be
// fetched by hand in a browser. Saved files go to 真人发音\手动下载 and are picked up by fuku-get.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '真人发音', 'Fukujinzuke');
const MANUAL = path.join(ROOT, '真人发音', '手动下载');
const H = { 'User-Agent': 'kana-study-personal/1.0 (personal study tool)' };

// same word → recording map as fuku-get.js
const cand = JSON.parse(fs.readFileSync(__dirname + '/fuku-candidates.json', 'utf8'));
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const src = tpl.slice(tpl.indexOf('const BASIC'), tpl.indexOf('// ---------------- helpers'));
const K = new Function(src + '; return {MINI};')();
const REJECT = new Set(['けん']);
const PREFER = { 'くも': '雲' };
const map = { ...cand.exact };
for (const [w, v] of Object.entries(cand.byReading)) {
  if (REJECT.has(w)) continue;
  const o = v.options.find(x => x[0] === PREFER[w]) || v.options[0];
  map[w] = o[1];
}
for (const m of K.MINI) { const a = m[0][0], b = m[1][0]; if (!(map[a] && map[b])) { delete map[a]; delete map[b]; } }
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

const human = fs.existsSync(__dirname + '/human.json') ? JSON.parse(fs.readFileSync(__dirname + '/human.json', 'utf8')) : {};
const ka = fs.existsSync(__dirname + '/ka.json') ? JSON.parse(fs.readFileSync(__dirname + '/ka.json', 'utf8')) : {};
const words = Object.keys(map);
const order = [...words.filter(w => [...w].length === 1 && !ka[w]), ...words.filter(w => [...w].length !== 1 && !ka[w])];
const todo = order.filter(w => !human[w] && !fs.existsSync(path.join(DIR, String(words.indexOf(w) + 1).padStart(3, '0') + '.wav')));

(async () => {
  // direct upload.wikimedia.org URLs; "?download" makes the browser save the file instead of playing it
  const titles = todo.map(w => map[w]), urls = {};
  for (let i = 0; i < titles.length; i += 40) {
    const part = titles.slice(i, i + 40);
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=' + encodeURIComponent(part.join('|'));
    const j = await (await fetch(u, { headers: H, signal: AbortSignal.timeout(30000) })).json();
    const norm = {}; (j.query.normalized || []).forEach(n => norm[n.to] = n.from);
    for (const p of Object.values(j.query.pages)) if (p.imageinfo) urls[norm[p.title] || p.title] = p.imageinfo[0].url;
  }
  fs.mkdirSync(MANUAL, { recursive: true });
  const rows = todo.map((w, n) => {
    const url = urls[map[w]] || 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(map[w].replace(/^File:/, ''));
    const page = 'https://commons.wikimedia.org/wiki/' + map[w].replace(/ /g, '_');
    console.log(`${n + 1}. ${w}  ${page}`);
    return `<li><a href="${url.split('?')[0]}?download">${n + 1}. ${w}</a> · <a href="${page}" style="font-size:16px">网页</a></li>`;
  }).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>手动下载清单</title>
<style>body{font:20px/1.6 sans-serif;max-width:720px;margin:24px auto;padding:0 16px}li{margin:6px 0}a{font-size:26px}code{background:#eee;padding:2px 6px}</style>
<h2>真人发音 · 手动下载（${todo.length} 个）</h2>
<p>保存位置：<code>${MANUAL}</code><br>文件名不用改，原名保存即可。<br>
如果打开的是 “Too Many Requests / 429” 错误页，等一分钟再点。</p>
<p>录音：Fukujinzuke（Lingua Libre / Wikimedia Commons，CC BY 4.0）</p>
<ol style="list-style:none;padding:0">
${rows}
</ol>`;
  const out = path.join(ROOT, '手动下载清单.html');
  fs.writeFileSync(out, html);
  console.log('todo', todo.length, 'urls', Object.keys(urls).length, '→', out);
})();
