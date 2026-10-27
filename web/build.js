// Inject lyric data into the template and embed a subset of the font as woff2.
// Usage: node build.js <font.ttf> <out.html> [public]
// "public" builds the shareable edition: public-domain children's songs instead of your own playlist.
const fs = require('fs');
const subsetFont = require('subset-font');
const [, , FONT, OUT, MODE] = process.argv;
const PUB = MODE === 'public';
const sfx = PUB ? '-public' : '';
const LYRICSRC = PUB
  ? '示例歌词来自已进入公有领域的日本童谣、唱歌；你导入的歌词只保存在这台手机里。'
  : '歌词片段来自你的网易云歌单，仅供个人学习使用。';

(async () => {
  const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
  const data = fs.readFileSync(__dirname + `/data${sfx}.json`, 'utf8');
  let html = tpl.replace('/*__DATA__*/null', data).replace('/*__VOICE__*/', '春日部つむぎ').replace('/*__LYRICSRC__*/', LYRICSRC);
  const audioPath = __dirname + '/audio.json';
  if (fs.existsSync(audioPath)) {
    // only clips the page can play (old lyric lines are left out)
    const all = JSON.parse(fs.readFileSync(audioPath, 'utf8'));
    const needPath = __dirname + `/needed${sfx}.json`;
    const need = fs.existsSync(needPath) ? JSON.parse(fs.readFileSync(needPath, 'utf8')) : Object.keys(all);
    const used = {}; for (const k of need) if (all[k]) used[k] = all[k];
    // native-speaker word recordings replace the synthesized ones where available
    const hPath = __dirname + '/human.json';
    const human = fs.existsSync(hPath) ? JSON.parse(fs.readFileSync(hPath, 'utf8')) : {};
    // Kanji alive studio recordings take priority for words (CC BY 4.0)
    const kaPath = __dirname + '/ka.json';
    if (fs.existsSync(kaPath)) Object.assign(human, JSON.parse(fs.readFileSync(kaPath, 'utf8')));
    // ぢ is pronounced exactly like じ in standard Japanese
    if (human['じ'] && !human['ぢ']) human['ぢ'] = human['じ'];
    for (const [k, v] of Object.entries(human)) if (k in used) used[k] = v;
    html = html.replace('/*__HUMAN__*/[]', JSON.stringify(Object.keys(human).filter(k => k in used)));
    html = html.replace('/*__AUDIO__*/{}', JSON.stringify(used));
  }
  html = html.replace('/*__STROKES__*/{}', fs.readFileSync(__dirname + '/strokes.json', 'utf8'));
  const tPath = __dirname + `/timings${sfx}.json`;
  if (fs.existsSync(tPath)) html = html.replace('/*__TIMINGS__*/{}', fs.readFileSync(tPath, 'utf8'));

  // app-wide text size: scale every px font size by --fz (display glyphs opted out with "font-size: ")
  html = html.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--fz))');

  // every character the page can show: the page itself + all kana (katakana is generated at runtime)
  const chars = new Set(html);
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (let c = 0x3000; c <= 0x30ff; c++) chars.add(String.fromCharCode(c));
  for (let c = 0xff01; c <= 0xff5e; c++) chars.add(String.fromCharCode(c));
  '、。・「」『』（）！？…♪✓✗←→✕🔊'.split('').forEach(c => chars.add(c));
  // the ~3000 common kanji (JIS level 1), so lyrics imported in the app still use the rounded font
  const sjis = new TextDecoder('shift_jis');
  for (let hi = 0x88; hi <= 0x98; hi++) for (let lo = 0x40; lo <= 0xfc; lo++) {
    const c = sjis.decode(Uint8Array.of(hi, lo));
    if (/^[一-鿿]$/.test(c)) chars.add(c);
  }
  const text = [...chars].join('');

  const woff2 = await subsetFont(fs.readFileSync(FONT), text, { targetFormat: 'woff2' });
  html = html.replace('/*__FONT__*/', woff2.toString('base64'));
  fs.writeFileSync(OUT, html);
  console.log('chars', chars.size, 'font KB', Math.round(woff2.length / 1024), 'html KB', Math.round(Buffer.byteLength(html) / 1024));
})();
