// Download a few recordings from each main Lingua Libre speaker and write a local listening page,
// so the speakers can be judged by ear before any of them is used.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', '真人发音试听');
const rec = JSON.parse(fs.readFileSync(__dirname + '/ll-readings.json', 'utf8'));
const H = { 'User-Agent': 'kana-study-personal/1.0 (personal study tool)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SPEAKERS = ['Fukujinzuke', 'CKali', '葵心', 'Zsrtrgh', 'I JethroBT'];
// common words to compare across speakers where possible
const PREFER = ['ねこ', 'いぬ', 'みず', 'さくら', 'ありがとう', 'にほん', 'やま', 'ほん', 'はな', 'そら', 'あめ', 'くるま', 'てがみ', 'ともだち', 'がっこう'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  for (const sp of SPEAKERS) {
    const mine = rec.filter(r => r.speaker === sp);
    const picks = [...PREFER.map(w => mine.find(r => r.reading === w)).filter(Boolean), ...mine].slice(0, 4);
    for (const [i, r] of picks.entries()) {
      const file = `${SPEAKERS.indexOf(sp)}-${i}.wav`;
      const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(r.title.replace(/^File:/, ''));
      for (let k = 0; k < 5 && !fs.existsSync(path.join(OUT, file)); k++) {
        const res = await fetch(url, { headers: H });
        if (res.ok && /audio/.test(res.headers.get('content-type') || '')) { fs.writeFileSync(path.join(OUT, file), Buffer.from(await res.arrayBuffer())); break; }
        await sleep(4000 * (k + 1));
      }
      rows.push({ sp, file, word: r.word, reading: r.reading });
      await sleep(1500);
    }
  }
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>真人发音试听</title><style>body{font-family:sans-serif;font-size:20px;max-width:640px;margin:20px auto;padding:0 16px;background:#F6EFE4;color:#2B2420}
h2{margin-top:28px}.r{display:flex;align-items:center;gap:12px;margin:8px 0}.w{font-size:28px;min-width:5em}audio{flex:1}</style></head><body>
<h1>真人发音试听</h1><p>来自 Wikimedia Commons / Lingua Libre 的公开录音。听一听哪几位读得自然、标准。</p>
${SPEAKERS.map((sp, si) => `<h2>${si + 1}号：${sp}</h2>` + rows.filter(r => r.sp === sp).map(r => `<div class="r"><span class="w">${r.word}<br><small style="font-size:15px;color:#7A6C60">${r.reading}</small></span><audio controls preload="none" src="${r.file}"></audio></div>`).join('')).join('')}
</body></html>`;
  fs.writeFileSync(path.join(OUT, '试听.html'), html);
  console.log('wrote', rows.length, 'samples');
})();
