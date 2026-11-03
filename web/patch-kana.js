// Insert the katakana picture table into template.html and point the picture helpers at it.
const fs = require('fs');
const f = __dirname + '/template.html';
let t = fs.readFileSync(f, 'utf8');
const k = fs.readFileSync(__dirname + '/kpics.js', 'utf8').trim();
if (!t.includes('const KPICS')) t = t.replace('// ---------------- helpers ----------------', k + '\n// ---------------- helpers ----------------');

// pictures / labels for either script
t = t.replace(
  "function picSVG(ch, size = 200) {\n  const p = PICS[toHira(ch)], ds = STROKES[toHira(ch)];",
  "const picOf = ch => isKataStr(ch) ? KPICS[ch] : PICS[ch];\nconst labelOf = ch => isKataStr(ch) ? KPICLABEL[ch] : PICLABEL[ch];\nfunction picSVG(ch, size = 200) {\n  const p = picOf(ch), ds = STROKES[ch];");
t = t.replace(
  "const picTitle = ch => PICLABEL[toHira(ch)] ? `<div class=\"pictitle\">${PICLABEL[toHira(ch)]}</div>` : '';",
  "const picTitle = ch => labelOf(ch) ? `<div class=\"pictitle\">${labelOf(ch)}</div>` : '';");
fs.writeFileSync(f, t);
console.log('KPICS', t.includes('const KPICS'), 'picOf', t.includes('const picOf'), 'labelOf in title', t.includes('labelOf(ch) ?'));
