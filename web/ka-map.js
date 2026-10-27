// Pick Kanji alive recordings (CC BY 4.0, https://kanjialive.com) for our practice words.
// Every word is tied by hand to the written form whose meaning matches (e.g. はし → 橋, not 端),
// so homophones with a different meaning are never used. Files are used unmodified.
// Writes ka.json: {word: base64 mp3}.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '真人发音', 'KanjiAlive', 'audio-mp3');

const FORM = {
  'あめ':'雨','あさ':'朝','いぬ':'犬','いえ':'家','うみ':'海','うた':'歌','えき':'駅','え':'絵','おと':'音','かお':'顔','きく':'聞く','くも':'雲','くつ':'靴',
  'こころ':'心','さくら':'桜','さかな':'魚','しお':'塩','すし':'寿司','すき':'好き','せかい':'世界','せんせい':'先生','そら':'空','そと':'外','たまご':'卵',
  'たべる':'食べる','ちず':'地図','ちかてつ':'地下鉄','つくえ':'机','てがみ':'手紙','とり':'鳥','とけい':'時計','なつ':'夏','なまえ':'名前','にほん':'日本',
  'ねこ':'猫','ねる':'寝る','のむ':'飲む','のり':'海苔','はな':'花','はし':'橋','ひかり':'光','ひと':'人','ふね':'船','ふゆ':'冬','へや':'部屋','ほし':'星',
  'ほん':'本','まど':'窓','マンガ':'漫画','みず':'水','みみ':'耳','むし':'虫','むら':'村','め':'目','もり':'森','やま':'山','やさい':'野菜','ゆき':'雪',
  'ゆめ':'夢','よる':'夜','よむ':'読む','らいねん':'来年','はる':'春','くるま':'車','れきし':'歴史','れいぞうこ':'冷蔵庫','かわ':'川','がっこう':'学校',
  'かぐ':'家具','ごはん':'御飯','ざっし':'雑誌','じかん':'時間','かぜ':'風','ぞう':'象','だいがく':'大学','はなぢ':'鼻血','ちぢむ':'縮む','つづく':'続く',
  'でんしゃ':'電車','ぶた':'豚','ぼうし':'帽子','さんぽ':'散歩','きゃく':'客','きょう':'今日','きょうしつ':'教室','しゃしん':'写真','しゅくだい':'宿題',
  'しょくじ':'食事','おちゃ':'お茶','ちゅうごく':'中国','ぎゅうにゅう':'牛乳','ひゃく':'百','ひょう':'表','ひょうじょう':'表情','みゃく':'脈',
  'さんみゃく':'山脈','みょうじ':'名字','りゃくご':'略語','りょうり':'料理','ぎゃく':'逆','きんぎょ':'金魚','じゅぎょう':'授業','じょうず':'上手',
  'じょせい':'女性','さんびゃく':'三百','びょういん':'病院','びょうき':'病気','はっぴゃく':'八百','ろっぴゃく':'六百','いっしょ':'一緒','きっぷ':'切符',
  'おかあさん':'お母さん','おにいさん':'お兄さん','おおきい':'大きい','ゆうき':'勇気','とおい':'遠い','ビール':'麦酒','さか':'坂','さっか':'作家','おっと':'夫',
  'とおり':'通り','びよういん':'美容院','じゆう':'自由','じゅう':'十','しゅじん':'主人','てんき':'天気','でんき':'電気','へいや':'平野','しじん':'詩人',
  'こい':'恋','こうい':'好意',
};

// single kana voiced by a one-beat Kanji alive word (studio recording of exactly that sound)
const KANA_FORM = {
  'い':'胃','え':'絵','か':'香','く':'区','け':'毛','さ':'差','し':'詩','す':'巣','ち':'血','と':'戸','に':'荷','ね':'根','は':'葉',
  'ひ':'火','ふ':'歩','み':'身','め':'目','や':'矢','ゆ':'湯','わ':'輪','ぐ':'具','じ':'字','び':'美','ぶ':'部',
};
Object.assign(FORM, KANA_FORM);
// minimal CSV parser (quoted fields with doubled quotes)
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const rows = parseCSV(fs.readFileSync(__dirname + '/ka_data.csv', 'utf8'));
const head = rows[0], iK = head.indexOf('kname'), iE = head.indexOf('examples');
const files = new Set(fs.readdirSync(DIR));
// written form → audio file name
const fileFor = {};
for (const r of rows.slice(1)) {
  if (!r[iE]) continue;
  let ex; try { ex = JSON.parse(r[iE]); } catch (e) { continue; }
  ex.forEach((e, n) => {
    const form = e[0].replace(/^\*/, '').replace(/（.*$/, '');
    const letter = String.fromCharCode(97 + n);
    const name = [...files].find(f => f.startsWith(r[iK] + '_') && f.endsWith('_' + letter + '.mp3'));
    if (name && !fileFor[form]) fileFor[form] = name;
  });
}

const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const MINI = new Function(tpl.slice(tpl.indexOf('const MINI'), tpl.indexOf('// 易混字')) + '; return MINI;')();
const out = {}, missing = [];
for (const [w, form] of Object.entries(FORM)) { const f = fileFor[form]; if (f) out[w] = fs.readFileSync(path.join(DIR, f)).toString('base64'); else missing.push(w + '=' + form); }
// a listening pair needs one voice for both words
let dropped = [];
for (const m of MINI) { const a = m[0][0], b = m[1][0]; if (!!out[a] !== !!out[b]) { dropped.push(a, b); delete out[a]; delete out[b]; } }
fs.writeFileSync(__dirname + '/ka.json', JSON.stringify(out));
console.log('Kanji alive clips', Object.keys(out).length, '| not found', missing.join(' ') || '-', '| dropped for listening pairs', dropped.join(' ') || '-');
