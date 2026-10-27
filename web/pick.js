// Parse the lyric list, tokenize with kuromoji, and pick example lines per kana.
// Usage: node pick.js <lyrics.txt> <out.json>
const fs = require('fs');
const path = require('path');
const kuromoji = require('kuromoji');

const [, , SRC, OUT] = process.argv;
// SMALL_LIST=1 for a short song list: keeps repetitive lines and lets one line serve several kana
const SMALL_LIST = !!process.env.SMALL_LIST;
const text = fs.readFileSync(SRC, 'utf8').replace(/\r/g, '');

// ---------- parse songs ----------
const songs = [];
let cur = null;
for (const raw of text.split('\n')) {
  const line = raw.trim();
  const m = line.match(/^【(\d+)】(.+)$/);
  if (m) {
    const t = m[2];
    const i = t.lastIndexOf(' - ');
    cur = { title: i > 0 ? t.slice(0, i).trim() : t, artist: i > 0 ? t.slice(i + 3).trim() : '', lines: [] };
    songs.push(cur);
    continue;
  }
  if (!cur || !line || /^[-=]{5,}$/.test(line)) continue;
  if (/作词|作曲|编曲|作詞|編曲|制作|混音|和声|吉他|贝斯|鼓|母带|Lyric|Music|Arrang|Vocal|Mix|OP:|SP:|：|:/i.test(line)) continue;
  if (!/[ぁ-ゖァ-ヺ]/.test(line)) continue;
  cur.lines.push(line);
}

// ---------- kana sets ----------
const H = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const D = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const Y = [];
for (const c of 'きしちにひみりぎじびぴ') for (const s of 'ゃゅょ') Y.push(c + s);
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const units = [...H, ...D, ...Y];
const targets = [];
for (const u of units) { targets.push(u); targets.push(toKata(u)); }
// sokuon, long-vowel mark and loanword-only katakana combos
targets.push('っ', 'ッ', 'ー', ...'ファ フィ フェ フォ ティ ディ トゥ ウィ ウェ ウォ ヴァ ヴィ シェ ジェ チェ デュ'.split(' '));

const SMALL = 'ゃゅょャュョ';

// ---------- reading check against the voice engine ----------
// keep a line only if VOICEVOX reads it the way the furigana says (otherwise you'd hear one thing and see another)
const VOWEL = {};
for (const [v, row] of Object.entries({ a: 'あかさたなはまやらわがざだばぱゃぁ', i: 'いきしちにひみりぎじぢびぴぃ', u: 'うくすつぬふむゆるぐずづぶぷゅぅ', e: 'えけせてねへめれげぜでべぺぇ', o: 'おこそとのほもよろをごぞどぼぽょぉ' }))
  for (const ch of row) VOWEL[ch] = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' }[v];
function norm(s) {
  s = toHira(s).replace(/[^ぁ-ゖー]/g, '');
  s = s.replace(/を/g, 'お').replace(/ぢ/g, 'じ').replace(/づ/g, 'ず').replace(/ゔ/g, 'ぶ');
  // spellings that sound the same: ー / おう / えい are all just a long vowel
  let out = '';
  for (const ch of s) {
    const pv = VOWEL[out[out.length - 1]];
    if (ch === 'ー') out += pv || '';
    else if (ch === 'う' && pv === 'お') out += 'お';
    else if (ch === 'い' && pv === 'え') out += 'え';
    else out += ch;
  }
  return out;
}
const verified = new Map();
async function verify(c) {
  if (verified.has(c.l)) return verified.get(c.l);
  let ok = false;
  try {
    // readings given by hand are sent to the engine as kana, so it says them the same way
    const say = c.toks.map(t => t.f ? t.r : t.s).join('');
    const q = await (await fetch('http://127.0.0.1:50021/audio_query?speaker=14&text=' + encodeURIComponent(say), { method: 'POST' })).json();
    const vv = q.accent_phrases.map(a => a.moras.map(m => m.text).join('')).join('');
    ok = c.toks.every(t => t.p || !/[一-鿿々]/.test(t.s)) && norm(c.toks.map(t => t.p || '').join('')) === norm(vv);
  } catch (e) { ok = false; }
  verified.set(c.l, ok);
  return ok;
}

kuromoji.builder({ dicPath: path.join(__dirname, 'node_modules/kuromoji/dict') }).build(async (err, tk) => {
  if (err) throw err;

  // ---------- candidate lines ----------
  const seen = new Set();
  const cands = [];
  songs.forEach((sg, si) => {
    for (const raw of sg.lines) {
      // 漢字(よみ) / 漢字（よみ）: a reading given by hand for the run of kanji before the bracket
      const parts = [], RUBY = /([一-鿿々〆ヶ]+)[(（]([ぁ-ゖー]+)[)）]/g;
      let last = 0, m;
      while ((m = RUBY.exec(raw))) { parts.push(raw.slice(last, m.index), { s: m[1], r: m[2] }); last = RUBY.lastIndex; }
      parts.push(raw.slice(last));
      const l = parts.map(p => typeof p === 'string' ? p : p.s).join('');
      const key = l.replace(/\s/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const len = [...key].length;
      if (len < 5 || len > 30) continue;
      // clean example lines only: no latin, no brackets, not mostly interjections / stretched sounds
      if (/[A-Za-zＡ-Ｚａ-ｚ()（）［］\[\]【】]/.test(l)) continue;
      const fill = (key.match(/[ぁぃぅぇぉァィゥェォー〜～…・]/g) || []).length;
      if (fill > len * 0.25) continue;
      const toks = parts.flatMap(p => typeof p !== 'string' ? [{ s: p.s, r: p.r, p: p.r, pos: '名詞', f: 1 }]
        : !p ? [] : tk.tokenize(p).map(t => ({
          s: t.surface_form,
          r: t.reading && t.reading !== '*' ? toHira(t.reading) : '',
          p: t.pronunciation && t.pronunciation !== '*' ? toHira(t.pronunciation) : '',
          pos: t.pos,
        })));
      if (toks.filter(t => t.pos === '感動詞').length >= 2) continue;
      // children's songs repeat on purpose (春が来た 春が来た): SMALL_LIST=1 keeps those lines
      if (SMALL_LIST) { cands.push({ si, l, len, toks }); continue; }
      if (toks.some((t, i) => i >= 2 && t.s === toks[i - 1].s && t.s === toks[i - 2].s)) continue;
      // no repeated words / refrains inside one line (e.g. the same onomatopoeia twice)
      // reduplicated words right next to each other (たんたん, そもそも) are fine; the same word coming back later is a refrain
      const lastAt = new Map();
      let refrain = false;
      toks.forEach((t, i) => {
        if (t.s.length < 2 || t.pos === '助詞' || t.pos === '助動詞') return;
        if (lastAt.has(t.s) && i - lastAt.get(t.s) > 1) refrain = true;
        lastAt.set(t.s, i);
      });
      if (refrain) continue;
      if (/(.{3,}).*\1/.test(key)) continue;
      cands.push({ si, l, len, toks });
    }
  });

  // ---------- score a line for a target ----------
  function score(c, tgt) {
    if (!c.l.includes(tgt)) return null;
    const single = tgt.length === 1;
    let occ = 0, initial = 0, particleOnly = true, inKanaWord = 0;
    let off = 0;
    for (const t of c.toks) {
      let idx = t.s.indexOf(tgt);
      while (idx >= 0) {
        const next = t.s[idx + tgt.length];
        // (a missing next char must not count as "small kana": ''.includes is always true)
        if (!(single && next && SMALL.includes(next))) {
          occ++;
          if (idx === 0) initial++;
          const isParticle = t.pos === '助詞' && t.s === tgt && 'はへをハヘヲ'.includes(tgt);
          if (!isParticle) particleOnly = false;
          if (/^[ぁ-ゟ゠-ヿー]+$/.test(t.s) && t.s.length >= 2) inKanaWord++;
        }
        idx = t.s.indexOf(tgt, idx + 1);
      }
      off += t.s.length;
    }
    if (!occ) return null;
    let sc = 0;
    sc += Math.min(occ, 3) * 3;
    sc += Math.min(initial, 2) * 4;
    sc += Math.min(inKanaWord, 2) * 3;
    if (particleOnly && 'はへハヘ'.includes(tgt)) sc -= 12; // particle は/へ reads wa/e — bad example of the base sound
    // prefer 7-18 chars
    if (c.len < 7) sc -= (7 - c.len) * 1.5;
    if (c.len > 18) sc -= (c.len - 18) * 0.8;
    // fewer kanji = easier to read
    const kanji = (c.l.match(/[一-鿿]/g) || []).length;
    sc -= kanji * 0.4;
    return sc;
  }

  // fallback: the sound is hidden inside a kanji reading (e.g. 病 = びょう); hiragana targets only
  function scoreRead(c, tgt) {
    if (tgt !== toHira(tgt)) return null;
    for (const t of c.toks) {
      if (!/[一-鿿々]/.test(t.s) || !t.r) continue;
      const idx = t.r.indexOf(tgt);
      if (idx < 0) continue;
      if (tgt.length === 1 && t.r[idx + 1] && SMALL.includes(t.r[idx + 1])) continue;
      let sc = 0;
      if (c.len < 7) sc -= (7 - c.len) * 1.5;
      if (c.len > 18) sc -= (c.len - 18) * 0.8;
      return sc - 20;
    }
    return null;
  }

  // rarest targets pick first
  const pools = targets.map(tgt => {
    const list = [];
    for (const c of cands) {
      const s = score(c, tgt);
      if (s !== null) { list.push({ c, s }); continue; }
      const s2 = scoreRead(c, tgt);
      if (s2 !== null) list.push({ c, s: s2, read: true });
    }
    list.sort((a, b) => b.s - a.s);
    return { tgt, list };
  });
  pools.sort((a, b) => a.list.length - b.list.length);

  const PER = 3, SONG_CAP = 4;
  const songUse = new Map();
  const lineUse = new Set();
  const out = {};
  for (const { tgt, list } of pools) {
    const picked = [];
    const usedSongs = new Set();
    for (const pass of [0, 1]) {
      for (const { c, read } of list) {
        if (picked.length >= PER) break;
        if (usedSongs.has(c.si) || (!SMALL_LIST && lineUse.has(c.l))) continue;
        if (pass === 0 && (songUse.get(c.si) || 0) >= SONG_CAP) continue;
        if (!(await verify(c))) continue;
        picked.push({ ...c, read });
        usedSongs.add(c.si);
        lineUse.add(c.l);
        songUse.set(c.si, (songUse.get(c.si) || 0) + 1);
      }
    }
    out[tgt] = picked.map(c => ({
      song: c.si,
      ...(c.read ? { rd: 1 } : {}),
      t: c.toks.map(t => {
        const o = { s: t.s };
        if (/[一-鿿々]/.test(t.s) && t.r) o.r = t.r;
        if (t.f) o.f = 1; // hand-given reading: the voice is made from o.r, not from the kanji
        if (t.p) o.p = t.p; else if (/^[ぁ-ゟ゠-ヿー]+$/.test(t.s)) o.p = toHira(t.s);
        return o;
      }),
    }));
  }

  // only keep songs actually used
  const usedIdx = [...new Set(Object.values(out).flat().map(x => x.song))].sort((a, b) => a - b);
  const remap = new Map(usedIdx.map((v, i) => [v, i]));
  for (const k in out) for (const x of out[k]) x.song = remap.get(x.song);
  const songList = usedIdx.map(i => [songs[i].title, songs[i].artist]);

  fs.writeFileSync(OUT, JSON.stringify({ songs: songList, ex: out }));
  const counts = targets.map(t => `${t}:${(out[t] || []).length}`).filter(s => !s.endsWith(':3'));
  console.log('songs parsed', songs.length, 'candidate lines', cands.length, 'songs used', songList.length);
  console.log('targets with <3 examples:', counts.join(' '));
});
