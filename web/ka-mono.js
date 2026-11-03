// Which single kana can be voiced by a one-beat Kanji alive word (目→め, 二→に …)?
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '真人发音', 'KanjiAlive', 'audio-mp3');
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c;
  }
  return rows;
}
const rows = parseCSV(fs.readFileSync(__dirname + '/ka_data.csv', 'utf8'));
const head = rows[0], iK = head.indexOf('kname'), iE = head.indexOf('examples');
const files = fs.readdirSync(DIR);
const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ';
const found = {};
for (const r of rows.slice(1)) {
  let ex; try { ex = JSON.parse(r[iE]); } catch (e) { continue; }
  ex.forEach((e, n) => {
    const m = e[0].match(/^\*?([^（]+)（([ぁ-ゖ]+)）/); if (!m) return;
    const rd = m[2]; if (rd.length !== 1 || !kana.includes(rd)) return;
    const file = files.find(f => f.startsWith(r[iK] + '_') && f.endsWith('_' + String.fromCharCode(97 + n) + '.mp3'));
    if (file) (found[rd] = found[rd] || []).push(`${m[1]}=${e[1]}`);
  });
}
const human = JSON.parse(fs.readFileSync(__dirname + '/human.json', 'utf8'));
const fukuHas = JSON.parse(fs.readFileSync(__dirname + '/fuku-candidates.json', 'utf8'));
console.log('kana with a one-beat Kanji alive word:', Object.keys(found).length);
for (const k of kana) if (found[k]) console.log(k, found[k].slice(0, 3).join(' / '));
