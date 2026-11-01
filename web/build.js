// Build the app folder that goes into the APK: index.html + audio/ + data/ + img/.
// Usage: node build.js <font.ttf> <out folder> [public]
// "public" builds the shareable edition: public-domain children's songs, no copyrighted resources.
// Every recording is a separate Opus file (KANA_AUDIO=mp3 keeps MP3 instead, should a phone not play Opus).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const subsetFont = require('subset-font');
const [, , FONT, OUT, MODE] = process.argv;
const PUB = MODE === 'public';
const sfx = PUB ? '-public' : '';
const RESDIR = process.env.KANA_RES || path.join(__dirname, '..', '资源处理');
const LOCALFF = 'E:\\ruanjian\\ffmpeg-n9.0-latest-win64-gpl-9.0\\bin\\ffmpeg.exe';
const FFMPEG = process.env.FFMPEG || (fs.existsSync(LOCALFF) ? LOCALFF : 'ffmpeg');
const EXT = process.env.KANA_AUDIO === 'mp3' ? 'mp3' : 'ogg';
const LYRICSRC = PUB
  ? '示例歌词来自已进入公有领域的日本童谣、唱歌；你导入的歌词只保存在这台手机里。'
  : '歌词片段来自你的网易云歌单，仅供个人学习使用。';
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const run = (args) => new Promise((ok, no) => execFile(FFMPEG, args, { maxBuffer: 1 << 24 }, (e, so, se) => e ? no(e) : ok(se)));
// a few ffmpeg processes at a time
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
function copyDir(src, dst, filter = () => true) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dst, { recursive: true }); let n = 0;
  for (const f of fs.readdirSync(src)) if (filter(f)) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); n++; }
  return n;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
  let html = tpl.replace('/*__DATA__*/null', fs.readFileSync(__dirname + `/data${sfx}.json`, 'utf8'))
    .replace('/*__VOICE__*/', '春日部つむぎ').replace('/*__LYRICSRC__*/', LYRICSRC).replace('/*__EXT__*/', EXT);

  // ---- all short recordings (kana, words, lyric lines, textbook) as {key: base64 mp3} ----
  const all = readJSON(__dirname + '/audio.json');
  const need = readJSON(__dirname + `/needed${sfx}.json`);
  const used = {}; for (const k of need) if (all[k]) used[k] = all[k];
  // native-speaker recordings replace synthesized ones where available
  const human = fs.existsSync(__dirname + '/human.json') ? readJSON(__dirname + '/human.json') : {};
  if (fs.existsSync(__dirname + '/ka.json')) Object.assign(human, readJSON(__dirname + '/ka.json'));
  if (human['じ'] && !human['ぢ']) human['ぢ'] = human['じ']; // ぢ sounds exactly like じ
  for (const [k, v] of Object.entries(human)) if (k in used) used[k] = v;
  let tbook = null;
  if (!PUB) {
    // the textbook teacher: every single kana and the contrast pairs win over everything else
    if (fs.existsSync(RESDIR + '/tb.json')) for (const [k, v] of Object.entries(readJSON(RESDIR + '/tb.json'))) { used[k] = v; human[k] = v; }
    if (fs.existsSync(RESDIR + '/tbook.json')) { tbook = readJSON(RESDIR + '/tbook.json'); Object.assign(used, tbook.clips); delete tbook.clips; }
  }
  // ---- each clip → its own file, named by content hash (cached between builds) ----
  const cache = path.join(RESDIR, 'clip-cache'); fs.mkdirSync(cache, { recursive: true });
  const boundsCachePath = path.join(cache, 'bounds.json');
  const boundsCache = fs.existsSync(boundsCachePath) ? readJSON(boundsCachePath) : {};
  const TIMINGS = fs.existsSync(__dirname + `/timings${sfx}.json`) ? readJSON(__dirname + `/timings${sfx}.json`) : {};
  const map = {}, bounds = {}, jobs = [];
  for (const [k, b64] of Object.entries(used)) {
    const h = crypto.createHash('sha1').update(b64).digest('hex').slice(0, 14);
    map[k] = 'c/' + h;
    jobs.push({ k, h, b64 });
  }
  await pool(jobs, 8, async ({ k, h, b64 }) => {
    const mp3 = path.join(cache, h + '.mp3'), out = path.join(cache, h + '.' + EXT);
    if (!fs.existsSync(mp3)) fs.writeFileSync(mp3, Buffer.from(b64, 'base64'));
    if (EXT === 'ogg' && !fs.existsSync(out)) await run(['-v', 'error', '-i', mp3, '-ac', '1', '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', '-y', out]);
    // lyric lines: where the voice really starts and stops, for the karaoke timeline
    if (TIMINGS[k]) {
      if (!boundsCache[h]) {
        const log = await run(['-hide_banner', '-i', mp3, '-af', 'silencedetect=noise=-38dB:d=0.08', '-f', 'null', '-']).catch(e => '');
        const dur = (log.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).map(Number);
        const total = dur.length ? (dur[0] * 3600 + dur[1] * 60 + dur[2]) * 1000 : 0;
        const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1] * 1000), starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1] * 1000);
        const on = starts.length && starts[0] < 30 && ends.length ? ends[0] : 0;
        const off = starts.length && starts[starts.length - 1] > on ? starts[starts.length - 1] : total;
        boundsCache[h] = [Math.round(on), Math.round(off)];
      }
      bounds[k] = boundsCache[h];
    }
  });
  fs.writeFileSync(boundsCachePath, JSON.stringify(boundsCache));
  copyDir(cache, path.join(OUT, 'audio', 'c'), f => f.endsWith('.' + EXT) && jobs.some(j => f.startsWith(j.h)));
  html = html.replace('/*__AUDIO__*/{}', JSON.stringify(map)).replace('/*__BOUNDS__*/{}', JSON.stringify(bounds))
    .replace('/*__HUMAN__*/[]', JSON.stringify(Object.keys(human).filter(k => k in used)))
    .replace('/*__STROKES__*/{}', fs.readFileSync(__dirname + '/strokes.json', 'utf8'))
    .replace('/*__TIMINGS__*/{}', JSON.stringify(TIMINGS));

  // ---- big data sets as separate files, loaded by <script> before the app ----
  const dataFiles = [], dataText = [];
  const addData = (name, global, obj) => { const t = `window.${global}=${JSON.stringify(obj)};`; fs.writeFileSync(path.join(OUT, 'data', name), t); dataFiles.push(name); dataText.push(t); };
  const res = {};
  if (!PUB && fs.existsSync(RESDIR + '/vocab.json')) { addData('vocab.js', 'VOCAB_DATA', readJSON(RESDIR + '/vocab.json')); res.vocab = true;
    res.words = copyDir(path.join(RESDIR, EXT === 'ogg' ? 'w-opus' : 'w'), path.join(OUT, 'audio', 'w')); }
  if (!PUB && fs.existsSync(RESDIR + '/kanji.json')) { addData('kanji.js', 'KANJI_DATA', readJSON(RESDIR + '/kanji.json')); res.kanji = true;
    addData('kstrokes.js', 'KSTROKES_DATA', readJSON(RESDIR + '/kstrokes.json'));
    res.ka = copyDir(path.join(RESDIR, 'ka'), path.join(OUT, 'audio', 'ka')); }
  if (tbook) { addData('tbook.js', 'TBOOK_DATA', tbook); res.tb = true; }
  if (!PUB && fs.existsSync(RESDIR + '/mn')) res.mn = copyDir(path.join(RESDIR, 'mn'), path.join(OUT, 'img', 'mn')) > 0;
  html = html.replace('/*__RES__*/{}', JSON.stringify(res))
    .replace('<!--__DATAFILES__-->', dataFiles.map(f => `<script src="data/${f}"></script>`).join('\n'));

  // app-wide text size: scale every px font size by --fz (display glyphs opted out with "font-size: ")
  html = html.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--fz))');

  // every character the page or its data can show, + all kana + the ~3000 common kanji (JIS level 1)
  const chars = new Set(html + dataText.join(''));
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (let c = 0x3000; c <= 0x30ff; c++) chars.add(String.fromCharCode(c));
  for (let c = 0xff01; c <= 0xff5e; c++) chars.add(String.fromCharCode(c));
  '、。・「」『』（）！？…♪✓✗←→✕🔊'.split('').forEach(c => chars.add(c));
  const sjis = new TextDecoder('shift_jis');
  for (let hi = 0x88; hi <= 0x98; hi++) for (let lo = 0x40; lo <= 0xfc; lo++) { const c = sjis.decode(Uint8Array.of(hi, lo)); if (/^[一-鿿]$/.test(c)) chars.add(c); }
  const woff2 = await subsetFont(fs.readFileSync(FONT), [...chars].join(''), { targetFormat: 'woff2' });
  html = html.replace('/*__FONT__*/', woff2.toString('base64'));
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  const size = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0) : 0;
  console.log(`clips ${jobs.length} (${EXT}) | data ${dataFiles.join(', ') || '-'} | font KB ${Math.round(woff2.length / 1024)} | page KB ${Math.round(Buffer.byteLength(html) / 1024)} | folder MB ${(size(OUT) / 1e6).toFixed(1)}`, res);
})().catch(e => { console.error(e); process.exit(1); });
