// Redraw the pictures that read as too abstract. Entries are replaced whole.
const fs = require('fs');
const f = __dirname + '/template.html';
let t = fs.readFileSync(f, 'utf8');
const q = s => "'" + s.replace(/'/g, "\\'") + "'";

function setEntry(table, ch, parts) {
  const start = t.indexOf(`const ${table} = {`);
  const i = t.indexOf(`'${ch}':[`, start);
  const j = t.indexOf(`],\n`, i);
  if (start < 0 || i < 0 || j < 0) throw new Error('not found ' + table + ' ' + ch);
  t = t.slice(0, i) + `'${ch}':[${parts.map(q).join(',')}` + t.slice(j);
}
// labels live either as one JSON line ("あ":"…") or a multi-line literal ('ア':'…')
function setLabel(table, ch, label) {
  const start = t.indexOf(`const ${table} = `);
  if (start < 0) throw new Error('no table ' + table);
  const re = new RegExp(`(["'])${ch}\\1:(["'])(.*?)\\2`);
  const m = re.exec(t.slice(start));
  if (!m) throw new Error('no label ' + ch);
  const at = start + m.index;
  t = t.slice(0, at) + `${m[1]}${ch}${m[1]}:${m[2]}${label}${m[2]}` + t.slice(at + m[0].length);
}

// ---- katakana ----
setEntry('KPICS', 'ア', ['<path class="d2" d="M22 92 h24"/>', '上面一横一折是迎风飘的旗面，斜线是旗杆。取自“阿”的左耳旁，读 a', '<path class="dg" d="M24 26 L86 22 L60 42z"/>']);
setEntry('KPICS', 'ク', ['<circle class="df" cx="46" cy="10" r="9"/><path class="d2" d="M10 98 H100"/>', '一个人深深弯腰鞠躬：左上是头，往下是弯着的背（取自“久”），哭(ku)']);
setEntry('KPICS', 'コ', ['', '一个开着左边口的箱子（取自“己”的上半），扣(ko)', '<path class="dg" d="M30 31 h53 v47 h-53z"/>']);
setEntry('KPICS', 'サ', ['<path class="d2" d="M40 54 H62 M40 66 H60 M40 78 H58 M46 48 V90 M54 46 V90"/><circle class="df" cx="94" cy="88" r="10"/><path class="dk" d="M90 84 l8 0 l0 8 l-8 0z" style="opacity:.25"/>', '一横两竖就是足球门（サッカー）：横是门梁，两竖是门柱，中间是网，撒(sa)']);
setEntry('KPICS', 'ス', ['<circle class="df" cx="54" cy="12" r="8"/>', '迈开大步跑的人：上面是头，横是手臂，两条斜线是腿（取自“須”），丝(su)']);
setEntry('KPICS', 'ム', ['<circle class="df" cx="54" cy="16" r="10"/>', '像弯起来的胳膊秀肌肉：上面是拳头，下面是肘弯，muscle 的 mu（取自“牟”）']);
setEntry('KPICS', 'ヲ', ['<path class="d1" d="M26 47 h50" stroke-dasharray="6 5"/>', '就是 フ 中间多了一横（虚线那一横）：只当助词用，读 o（取自“乎”）']);
setLabel('KPICLABEL', 'ク', '🙇 弯腰鞠躬的人');
setLabel('KPICLABEL', 'コ', '📦 开着口的箱子');
setLabel('KPICLABEL', 'サ', '⚽ 足球门');
setLabel('KPICLABEL', 'ス', '🏃 迈大步的人');
setLabel('KPICLABEL', 'ム', '💪 弯起的胳膊');
setLabel('KPICLABEL', 'ヲ', '🪝 フ 中间加一横');

// ---- hiragana ----
setEntry('PICS', 'な', ['<path class="d1" d="M84 88 q10 6 8 18 M76 92 q-2 12 -12 16"/>', '左上是“十”，右下绕了一个圈：一根打了结的绳子，那(na)', '<circle class="dg" cx="62" cy="72" r="19"/>']);
setEntry('PICS', 'ら', ['<path class="d2" d="M46 18 l8 -16"/><circle class="dk" cx="60" cy="66" r="4"/><circle class="dg" cx="30" cy="92" r="7"/>', '蹲着的兔子：上面两只竖起的耳朵，下面圆圆的是身体，拉(ra)']);
setEntry('PICS', 'ろ', ['<text class="dt" x="84" y="22" style="font-size:30px;fill:var(--sub)">3</text>', '像一个数字 3，但下面不打圈（打圈的是 る），咯(ro)']);
setEntry('PICS', 'う', ['<path class="d1" d="M84 50 q8 10 0 20 M94 42 q14 18 0 36 M104 34 q18 26 0 52"/>', '像一只竖起的耳朵，在听“乌——”', '<ellipse class="du" cx="52" cy="64" rx="28" ry="36"/>']);
setLabel('PICLABEL', 'な', '🪢 打结的绳子');
setLabel('PICLABEL', 'ろ', '3️⃣ 不打圈的 3');

fs.writeFileSync(f, t);
console.log('patched');
